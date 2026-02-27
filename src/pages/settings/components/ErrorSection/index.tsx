import "./styles.css";

interface ErrorSectionProps {
  message: string;
}

export const ErrorSection = ({ message }: ErrorSectionProps) => {
  return (
    <section className="settings-error-section" aria-live="polite">
      <p className="settings-error-section__text">{message}</p>
    </section>
  );
};
