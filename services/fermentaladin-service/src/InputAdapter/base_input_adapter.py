from Util.base_io_adapter import IOAdapter
from abc import abstractmethod
import pandas as pd
import json

class InputAdapter(IOAdapter):
    @abstractmethod
    def transform_data(self, data: json) -> pd.DataFrame:
        return