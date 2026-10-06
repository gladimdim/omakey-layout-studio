import { useEffect, useState } from "react";

interface NumberFieldProps {
  label: string;
  value: number | undefined;
  step?: number;
  min?: number;
  max?: number;
  placeholder?: string;
  onChange: (v: number) => void;
}

/** Number input that lets you type "1." or "" without fighting you. */
export function NumberField({ label, value, step = 0.25, min, max, placeholder, onChange }: NumberFieldProps) {
  const [text, setText] = useState(value === undefined ? "" : String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(value === undefined ? "" : String(value));
  }, [value, focused]);
  return (
    <label className="field num">
      <span>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        value={text}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setText(e.target.value);
          const v = Number(e.target.value);
          if (e.target.value !== "" && Number.isFinite(v)) onChange(v);
        }}
      />
    </label>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  maxLength?: number;
  placeholder?: string;
  list?: string;
  onChange: (v: string) => void;
}

export function TextField({ label, value, maxLength, placeholder, list, onChange }: TextFieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="text"
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        list={list}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
