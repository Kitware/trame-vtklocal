def test_import():
    from trame_vtklocal.widgets.vtklocal import LocalView  # noqa: F401

    # For components only, the CustomWidget is also importable via trame
    from trame.widgets.vtklocal import LocalView  # noqa: F401,F811
