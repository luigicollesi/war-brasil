"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type ShowcaseModelErrorBoundaryProps = Readonly<{
  children: ReactNode;
  onError: (error: Error, info: ErrorInfo) => void;
}>;

type ShowcaseModelErrorBoundaryState = Readonly<{
  failed: boolean;
}>;

export class ShowcaseModelErrorBoundary extends Component<
  ShowcaseModelErrorBoundaryProps,
  ShowcaseModelErrorBoundaryState
> {
  state: ShowcaseModelErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ShowcaseModelErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError(error, info);
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
