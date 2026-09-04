export class RevisionCoordinator {
  private currentRevision: number | null = null;
  private requiredRevision: number | null = null;

  reset() {
    this.currentRevision = null;
    this.requiredRevision = null;
  }

  current() {
    return this.currentRevision;
  }

  required() {
    return this.requiredRevision;
  }

  observe(revision: number | null) {
    if (revision === null) return;

    if (this.currentRevision === null || revision >= this.currentRevision) {
      this.currentRevision = revision;
    }

    if (
      this.requiredRevision !== null &&
      revision >= this.requiredRevision
    ) {
      this.requiredRevision = null;
    }
  }

  require(revision: number) {
    this.requiredRevision = Math.max(this.requiredRevision ?? 0, revision);
  }

  hasObserved(revision: number) {
    return this.currentRevision !== null && this.currentRevision >= revision;
  }

  needsRequiredRevision() {
    return (
      this.requiredRevision !== null &&
      (this.currentRevision ?? 0) < this.requiredRevision
    );
  }

  isStaleResponse(revision: number | null) {
    return (
      revision !== null &&
      this.currentRevision !== null &&
      revision < this.currentRevision
    );
  }

  canApplyPatch(baseRevision: number | null, revision: number | null) {
    return (
      baseRevision !== null &&
      revision !== null &&
      this.currentRevision === baseRevision &&
      revision > baseRevision
    );
  }
}
