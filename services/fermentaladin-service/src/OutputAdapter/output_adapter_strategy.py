from Util.strategy_pattern import Strategy
from OutputAdapter.base_output_adapter import OutputAdapter
from OutputAdapter.chart_js_adapter import ChartJSAdapter
from OutputAdapter.df_adapter import DFAdapter


class OutputAdapterStrategy(Strategy[OutputAdapter]):
    pass


output_adapter_strategy = OutputAdapterStrategy()
output_adapter_strategy.register_strategy(ChartJSAdapter)
output_adapter_strategy.register_strategy(DFAdapter)
