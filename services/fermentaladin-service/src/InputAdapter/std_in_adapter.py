from .base_input_adapter import InputAdapter
from typing import ClassVar
import sys
import pandas as pd
import json
import logging


class STDINAdapter(InputAdapter):
    __qualname__: ClassVar[str] = "stdi"

    def transform_data(self, data: str) -> pd.DataFrame:
        try:
            input_df = pd.DataFrame(json.loads(data))
        except json.JSONDecodeError as error:
            logging.error("Invalid JSON input from stdi.")
            logging.error(error)
            sys.exit(1)
        return input_df
