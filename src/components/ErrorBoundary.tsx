import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Utan den har fangar en trasig deploy (t.ex. saknade env-variabler) bara en
 * blank sida — inget syns, inget fel loggas nagonstans anvandaren ser.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Piches kraschade:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="grid min-h-screen place-items-center px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold">Något gick fel</h1>
          <p className="mt-2 text-sm text-on-surface-variant">{this.state.error.message}</p>
          <p className="mt-4 text-xs text-on-surface-variant">
            Om detta är en ny driftsättning: kontrollera att VITE_SUPABASE_URL och
            VITE_SUPABASE_PUBLISHABLE_KEY är satta och att sidan är omdeployad
            efter att de lades till.
          </p>
        </div>
      </div>
    );
  }
}
