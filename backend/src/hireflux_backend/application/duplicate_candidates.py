import re
import unicodedata
from dataclasses import dataclass
from datetime import date, timedelta
from enum import StrEnum
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from hireflux_backend.domain.models import Application


class DuplicateConfidence(StrEnum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"


class DuplicateSignal(StrEnum):
    JOB_URL = "JOB_URL"
    REQUISITION_ID = "REQUISITION_ID"
    COMPANY = "COMPANY"
    TITLE = "TITLE"
    LOCATION = "LOCATION"


@dataclass(frozen=True, slots=True)
class DuplicateEvidence:
    company_name: str | None = None
    job_title: str | None = None
    job_url: str | None = None
    location: str | None = None
    requisition_id: str | None = None


@dataclass(frozen=True, slots=True)
class DuplicateCandidate:
    application: Application
    confidence: DuplicateConfidence
    matched_on: tuple[DuplicateSignal, ...]


_COMPANY_SUFFIXES = {
    "co",
    "company",
    "corp",
    "corporation",
    "inc",
    "incorporated",
    "llc",
    "ltd",
    "limited",
}
_TRACKING_PARAMETERS = {"fbclid", "gclid", "mc_cid", "mc_eid"}
_REQUISITION_PARAMETERS = {
    "gh_jid",
    "jobid",
    "job_id",
    "reqid",
    "req_id",
    "requisitionid",
    "requisition_id",
}


def find_duplicate_candidates(
    applications: tuple[Application, ...],
    evidence: DuplicateEvidence,
    *,
    today: date,
    limit: int = 3,
) -> tuple[DuplicateCandidate, ...]:
    input_company = _normalize_company(evidence.company_name)
    input_title = _normalize_text(evidence.job_title)
    input_location = _normalize_text(evidence.location)
    input_url = _normalize_url(evidence.job_url)
    input_requisition = _normalize_requisition(evidence.requisition_id) or _requisition_from_url(
        evidence.job_url
    )
    candidates: list[DuplicateCandidate] = []

    for application in applications:
        company = _normalize_company(application.company_name)
        title = _normalize_text(application.job_title)
        location = _normalize_text(application.location)
        job_url = _normalize_url(application.job_url)
        requisition = _requisition_from_url(application.job_url)
        signals: list[DuplicateSignal] = []

        if input_url and job_url and input_url == job_url:
            signals.append(DuplicateSignal.JOB_URL)
            if input_company and input_company == company:
                signals.append(DuplicateSignal.COMPANY)
            if input_title and input_title == title:
                signals.append(DuplicateSignal.TITLE)
            candidates.append(
                DuplicateCandidate(application, DuplicateConfidence.HIGH, tuple(signals))
            )
            continue

        if input_company and input_company == company and input_requisition and requisition:
            if input_requisition == requisition:
                signals.extend((DuplicateSignal.REQUISITION_ID, DuplicateSignal.COMPANY))
                if input_title and input_title == title:
                    signals.append(DuplicateSignal.TITLE)
                candidates.append(
                    DuplicateCandidate(application, DuplicateConfidence.HIGH, tuple(signals))
                )
            continue

        if not input_company or input_company != company or not input_title or input_title != title:
            continue
        if input_requisition and requisition and input_requisition != requisition:
            continue
        if input_location and location and input_location != location:
            continue

        comparison_date = application.applied_date or application.created_at.date()
        recency = timedelta(days=180 if input_location and location else 90)
        if comparison_date < today - recency:
            continue
        signals.extend((DuplicateSignal.COMPANY, DuplicateSignal.TITLE))
        if input_location and location and input_location == location:
            signals.append(DuplicateSignal.LOCATION)
        candidates.append(
            DuplicateCandidate(application, DuplicateConfidence.MEDIUM, tuple(signals))
        )

    confidence_order = {DuplicateConfidence.HIGH: 0, DuplicateConfidence.MEDIUM: 1}
    candidates.sort(
        key=lambda item: (
            confidence_order[item.confidence],
            -len(item.matched_on),
            -int(item.application.updated_at.timestamp()),
            item.application.application_id,
        )
    )
    return tuple(candidates[:limit])


def _normalize_text(value: str | None) -> str | None:
    if not value:
        return None
    normalized = unicodedata.normalize("NFKC", value).casefold()
    normalized = re.sub(r"[^\w]+", " ", normalized, flags=re.UNICODE)
    return " ".join(normalized.split()) or None


def _normalize_company(value: str | None) -> str | None:
    normalized = _normalize_text(value)
    if not normalized:
        return None
    tokens = normalized.split()
    while len(tokens) > 1 and tokens[-1] in _COMPANY_SUFFIXES:
        tokens.pop()
    return " ".join(tokens)


def _normalize_requisition(value: str | None) -> str | None:
    return _normalize_text(value)


def _normalize_url(value: str | None) -> str | None:
    if not value:
        return None
    try:
        parsed = urlsplit(value.strip())
        scheme = parsed.scheme.lower()
        host = parsed.hostname.casefold() if parsed.hostname else None
        port = parsed.port
    except ValueError:
        return None
    if scheme not in {"http", "https"} or not host:
        return None
    netloc = (
        host
        if port is None or (scheme, port) in {("http", 80), ("https", 443)}
        else f"{host}:{port}"
    )
    path = parsed.path.rstrip("/") or "/"
    parameters = [
        (key, value)
        for key, value in parse_qsl(parsed.query, keep_blank_values=True)
        if not key.casefold().startswith("utm_") and key.casefold() not in _TRACKING_PARAMETERS
    ]
    parameters.sort(key=lambda item: (item[0].casefold(), item[1]))
    return urlunsplit((scheme, netloc, path, urlencode(parameters, doseq=True), ""))


def _requisition_from_url(value: str | None) -> str | None:
    if not value:
        return None
    try:
        parsed = urlsplit(value.strip())
        if parsed.scheme.lower() not in {"http", "https"} or not parsed.hostname:
            return None
        parameters = parse_qsl(parsed.query, keep_blank_values=False)
    except ValueError:
        return None
    for key, parameter_value in parameters:
        if key.casefold() in _REQUISITION_PARAMETERS:
            return _normalize_requisition(parameter_value)
    return None
