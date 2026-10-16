import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.mock('recharts', () => {
  const ChartStub = () => null;
  return {
    Area: ChartStub,
    AreaChart: ChartStub,
    CartesianGrid: ChartStub,
    ResponsiveContainer: ChartStub,
    Tooltip: ChartStub,
    XAxis: ChartStub,
    YAxis: ChartStub,
  };
});
