from Util.strategy_pattern import Strategy
from InputAdapter.base_input_adapter import InputAdapter
from InputAdapter.file_input_adapter import FileInputAdapter
from InputAdapter.std_in_adapter import STDINAdapter
from InputAdapter.excel_adapter import ExcelAdapter


class InputAdapterStrategy(Strategy[InputAdapter]):
    pass


input_adapter_strategy = InputAdapterStrategy()
input_adapter_strategy.register_strategy(FileInputAdapter)
input_adapter_strategy.register_strategy(STDINAdapter)
input_adapter_strategy.register_strategy(ExcelAdapter)
