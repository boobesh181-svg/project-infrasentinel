import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip
} from "recharts";

type MaterialPoint = {
  name: string;
  value: number;
};

const colors = ["#2563EB", "#16A34A", "#F59E0B", "#0EA5E9", "#9333EA", "#DC2626"];

const MaterialChart = ({ data }: { data: MaterialPoint[] }) => {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label
          >
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MaterialChart;
