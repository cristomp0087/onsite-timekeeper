'use client';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface HoursChartProps {
  data: { data: string; horas: number }[];
  title?: string;
}

export function HoursChart({ data, title = 'Horas por Dia' }: HoursChartProps) {
  const chartData = {
    labels: data.map((d) => {
      const date = parseISO(d.data);
      return format(date, 'dd/MM', { locale: ptBR });
    }),
    datasets: [
      {
        label: 'Horas',
        data: data.map((d) => Number(d.horas.toFixed(1))),
        backgroundColor: 'rgba(14, 165, 233, 0.8)',
        borderColor: 'rgba(14, 165, 233, 1)',
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            return `${context.parsed.y.toFixed(1)}h`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: number) => `${value}h`,
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="h-64">
        <Bar data={chartData} options={options as any} />
      </div>
    </div>
  );
}
