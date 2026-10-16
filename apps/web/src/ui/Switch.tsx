import { type ReactNode, useId } from "react";

/*
  Switch: an on/off setting with a label and an optional one-line reason.
    checked       boolean
    onChange      (checked: boolean) => void
    label         ReactNode
    description?  ReactNode
    disabled?     boolean
*/

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="k-switch-row">
      <div className="k-switch-texts">
        <label htmlFor={id} className="k-switch-label">
          {label}
        </label>
        {description ? (
          <p className="k-switch-desc" id={`${id}-d`}>
            {description}
          </p>
        ) : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-d` : undefined}
        className={`k-switch${checked ? " is-on" : ""}`}
        onClick={() => onChange(!checked)}
        disabled={disabled}
      >
        <span className="k-switch-thumb" aria-hidden="true" />
      </button>
    </div>
  );
}
