from hireflux_backend.application.workspace_export import neutralize_spreadsheet_formula


def test_spreadsheet_formula_neutralization_handles_leading_whitespace() -> None:
    assert neutralize_spreadsheet_formula("   =SUM(1,1)") == "'   =SUM(1,1)"
    assert neutralize_spreadsheet_formula("\t@command") == "'\t@command"
    assert neutralize_spreadsheet_formula("Amazon") == "Amazon"
    assert neutralize_spreadsheet_formula(None) == ""
