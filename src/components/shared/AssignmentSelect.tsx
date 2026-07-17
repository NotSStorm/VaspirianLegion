type AssignmentOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

interface AssignmentSelectProps {
  value: string;
  options: AssignmentOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
  className?: string;
}

export default function AssignmentSelect({ value, options, disabled, onChange, className = '' }: AssignmentSelectProps) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className={className}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );
}