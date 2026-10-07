import { Component, useEffect, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Called from the fallback; the boundary then renders its children again. */
  onReset: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
}

interface State {
  error?: Error;
}

/**
 * Catches a render crash in the editor (most likely a layout shape the code
 * didn't expect) and offers a way back instead of a blank page.
 */
export class EditorBoundary extends Component<Props, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Layout Studio editor crashed:", error);
  }

  private retry(fn: () => void) {
    fn();
    this.setState({ error: undefined });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="crash" role="alert">
        <h3>The editor hit a problem drawing this layout.</h3>
        <p className="hint">{error.message || String(error)}</p>
        <p>Your edits are kept in the undo history.</p>
        <div className="row">
          <button type="button" className="primary" onClick={() => this.retry(this.props.onReset)}>Reset to last good layout</button>
          {this.props.onUndo && (
            <button type="button" disabled={!this.props.canUndo} onClick={() => this.retry(this.props.onUndo!)}>Undo last change</button>
          )}
        </div>
      </div>
    );
  }
}

/** Renders nothing; calls `onGood` after every commit of its subtree, i.e. once the editor rendered fine. */
export function CommitProbe({ onGood }: { onGood: () => void }) {
  useEffect(onGood);
  return null;
}
