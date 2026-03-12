import pytest
from InputAdapter.file_input_adapter import FileInputAdapter
import pandas as pd
import os
import json

def test_load_file():
    adapter = FileInputAdapter()
    df = adapter.transform_data("./test/test_data/test_input.json")
    assert isinstance(df, pd.DataFrame)

def test_invalid_file_path():
    adapter = FileInputAdapter()
    
    with pytest.raises(FileNotFoundError):
        df = adapter.transform_data("INVALID_PATH")

def test_invalid_json_content():
    adapter = FileInputAdapter()
    
    with pytest.raises(json.JSONDecodeError) as file_not_found:
        file_path = "test_file.json"
        with open(file_path, "w+") as f:
            f.write("CORRUPT JSON")
            df = adapter.transform_data(file_path)

    os.remove(file_path)