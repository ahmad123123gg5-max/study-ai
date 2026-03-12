import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NavigationHistoryService {
  private readonly storageKey = 'smartedge_navigation_history_v1';
  private readonly maxEntries = 32;
  private readonly stack = signal<string[]>(this.loadStack());
  private pendingBackTarget: string | null = null;

  recordVisit(route: string | null | undefined) {
    const normalized = this.normalize(route);
    if (!normalized) {
      return;
    }

    const currentStack = this.stack();
    const currentRoute = currentStack[currentStack.length - 1] || null;

    if (this.pendingBackTarget === normalized) {
      this.pendingBackTarget = null;
      if (currentRoute !== normalized) {
        this.commit([...currentStack, normalized]);
      }
      return;
    }

    if (currentRoute === normalized) {
      return;
    }

    this.commit([...currentStack, normalized].slice(-this.maxEntries));
  }

  back(currentRoute: string | null | undefined, fallbackRoute?: string | null) {
    const normalizedCurrent = this.normalize(currentRoute);
    const normalizedFallback = this.normalize(fallbackRoute);
    const alignedStack = this.alignStack(normalizedCurrent);
    const previousRoute = this.findPreviousRoute(alignedStack, normalizedCurrent);

    if (previousRoute) {
      const targetIndex = alignedStack.lastIndexOf(previousRoute);
      this.pendingBackTarget = previousRoute;
      this.commit(alignedStack.slice(0, targetIndex + 1));
      return previousRoute;
    }

    if (normalizedFallback && normalizedFallback !== normalizedCurrent) {
      this.pendingBackTarget = normalizedFallback;
      this.commit([normalizedFallback]);
      return normalizedFallback;
    }

    return normalizedFallback;
  }

  clear() {
    this.pendingBackTarget = null;
    this.commit([]);
  }

  private alignStack(currentRoute: string | null) {
    const currentStack = [...this.stack()];
    if (!currentRoute) {
      return currentStack;
    }

    if (currentStack.length === 0) {
      return [currentRoute];
    }

    if (currentStack[currentStack.length - 1] === currentRoute) {
      return currentStack;
    }

    const existingIndex = currentStack.lastIndexOf(currentRoute);
    if (existingIndex >= 0) {
      return currentStack.slice(0, existingIndex + 1);
    }

    return [...currentStack, currentRoute].slice(-this.maxEntries);
  }

  private findPreviousRoute(stack: string[], currentRoute: string | null) {
    const activeRoute = currentRoute || stack[stack.length - 1] || null;
    if (!activeRoute) {
      return null;
    }

    for (let index = stack.length - 2; index >= 0; index -= 1) {
      if (stack[index] !== activeRoute) {
        return stack[index];
      }
    }

    return null;
  }

  private normalize(route: string | null | undefined) {
    const normalized = String(route || '').trim();
    return normalized || null;
  }

  private commit(nextStack: string[]) {
    this.stack.set(nextStack);
    this.persistStack(nextStack);
  }

  private loadStack() {
    if (typeof window === 'undefined') {
      return [];
    }

    try {
      const raw = window.sessionStorage.getItem(this.storageKey);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .map((item) => this.normalize(String(item || '')))
        .filter((item): item is string => !!item)
        .slice(-this.maxEntries);
    } catch {
      return [];
    }
  }

  private persistStack(stack: string[]) {
    if (typeof window === 'undefined') {
      return;
    }

    if (stack.length === 0) {
      window.sessionStorage.removeItem(this.storageKey);
      return;
    }

    window.sessionStorage.setItem(this.storageKey, JSON.stringify(stack));
  }
}
