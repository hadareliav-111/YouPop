import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  // Optional label shown in the fallback so it's clear which part of the
  // app failed (e.g. "This item's details"), rather than a generic message
  // for every possible crash site.
  label?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// To reset this boundary when the thing it's showing changes (e.g. a
// different item was opened), pass a `key` on the <ErrorBoundary> element
// itself from the parent — React will remount it, which is the idiomatic
// way to do this rather than reaching into the boundary's own state.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Render error caught by ErrorBoundary:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-fallback">
          <div className="error-fallback__icon" aria-hidden="true">
            ⚠️
          </div>
          <p className="error-fallback__title">
            {this.props.label ?? "Something went wrong"}
          </p>
          <p className="error-fallback__message">
            This couldn't be displayed. Your saved data is safe — try closing
            and reopening it.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
