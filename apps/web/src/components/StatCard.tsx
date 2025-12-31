import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  color?: 'primary' | 'success' | 'warning' | 'danger';
}

const colorClasses = {
  primary: 'bg-primary-50 text-primary-600',
  success: 'bg-green-50 text-green-600',
  warning: 'bg-yellow-50 text-yellow-600',
  danger: 'bg-red-50 text-red-600',
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'primary',
}: StatCardProps) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[color]}`}
        >
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
