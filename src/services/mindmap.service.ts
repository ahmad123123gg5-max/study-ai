import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AIService } from './ai.service';
import { NotificationService } from './notification.service';
import { LanguageCode, getLanguageDirection } from '../i18n/language-config';

export type MindMapNodeType =
  | 'root'
  | 'main'
  | 'sub'
  | 'detail'
  | 'example'
  | 'important'
  | 'definition'
  | 'warning';

export type MindMapViewMode = 'mindmap' | 'tree' | 'study' | 'compact';
export type MindMapGenerationMode = 'standard' | 'simplify' | 'expand';
export type MindMapThemeId =
  | 'classic_academic'
  | 'dark_study'
  | 'soft_minimal'
  | 'neon_focus'
  | 'kids_friendly'
  | 'medical_clean'
  | 'engineering_grid';
export type MindMapLineStyle = 'curved' | 'straight' | 'academic' | 'neon' | 'soft' | 'angled';
export type MindMapNodeShape = 'rounded' | 'glass' | 'pill' | 'academic';
export type MindMapDirection = 'center' | 'rtl' | 'vertical';
export type MindMapSpacing = 'compact' | 'balanced' | 'spacious';
export type MindMapNodeSize = 'compact' | 'balanced' | 'large';
export type MindMapBackgroundMode = 'minimal' | 'academic_grid';
export type MindMapVisualMode = 'default' | 'focus' | 'branch' | 'exam' | 'presentation';
export type MindMapNodeReviewState = 'understood' | 'review' | null;

export interface MindMapNode {
  id: string;
  title: string;
  type: MindMapNodeType;
  children?: MindMapNode[];
  summary?: string;
  colorHint?: string;
  level: number;
  parentId?: string | null;
  order?: number;
  isKeyPoint?: boolean;
  collapsed?: boolean;
  note?: string;
  customColor?: string;
  reviewState?: MindMapNodeReviewState;
}

export interface MindMapCustomizationSettings {
  themeId: MindMapThemeId;
  lineStyle: MindMapLineStyle;
  nodeShape: MindMapNodeShape;
  direction: MindMapDirection;
  spacing: MindMapSpacing;
  nodeSize: MindMapNodeSize;
  backgroundMode: MindMapBackgroundMode;
  showIcons: boolean;
  visualMode: MindMapVisualMode;
}

export interface MindMapLaunchContext {
  sourceText: string;
  sourceType: string;
  sourceTitle?: string;
  conversationId?: string;
  messageId?: string;
  language?: LanguageCode;
  mapName?: string;
  createdAt?: string;
}

export interface MindMapProgress {
  totalNodes: number;
  understoodNodes: number;
  reviewNodes: number;
  importantNodes: number;
  currentNodeId: string | null;
  understoodNodeIds: string[];
  reviewNodeIds: string[];
}

export interface SavedMindMap {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sourceText: string;
  sourceType: string;
  sourceTitle?: string;
  conversationId?: string;
  messageId?: string;
  language: LanguageCode;
  root: MindMapNode | null;
  viewMode: MindMapViewMode;
  customization: MindMapCustomizationSettings;
  progress: MindMapProgress;
}

interface GeneratedMindMapPayload {
  mapTitle?: string;
  root?: Partial<MindMapNode>;
}

export const DEFAULT_MINDMAP_CUSTOMIZATION: MindMapCustomizationSettings = {
  themeId: 'classic_academic',
  lineStyle: 'curved',
  nodeShape: 'rounded',
  direction: 'center',
  spacing: 'balanced',
  nodeSize: 'balanced',
  backgroundMode: 'minimal',
  showIcons: true,
  visualMode: 'default'
};

@Injectable({ providedIn: 'root' })
export class MindMapService {
  private readonly STORAGE_KEY = 'smartedge_mindmaps_v1';
  private readonly ACTIVE_MAP_KEY = 'smartedge_mindmap_active_id';
  private readonly ai = inject(AIService);
  private readonly ns = inject(NotificationService);

  launchContext = signal<MindMapLaunchContext | null>(null);
  savedMaps = signal<SavedMindMap[]>(this.loadSavedMaps());
  activeMapId = signal<string | null>(this.loadActiveMapId());

  activeMap = computed(() => {
    const activeId = this.activeMapId();
    if (!activeId) return null;
    return this.savedMaps().find(map => map.id === activeId) || null;
  });

  constructor() {
    effect(() => {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.savedMaps()));
    });

    effect(() => {
      const activeId = this.activeMapId();
      if (activeId) {
        localStorage.setItem(this.ACTIVE_MAP_KEY, activeId);
      } else {
        localStorage.removeItem(this.ACTIVE_MAP_KEY);
      }
    });
  }

  openFromSource(context: MindMapLaunchContext) {
    this.launchContext.set({
      ...context,
      sourceType: this.normalizeSourceType(context.sourceType),
      sourceText: context.sourceText.trim(),
      createdAt: context.createdAt || new Date().toISOString()
    });
  }

  consumeLaunchContext() {
    const context = this.launchContext();
    this.launchContext.set(null);
    return context;
  }

  setActiveMap(mapId: string | null) {
    this.activeMapId.set(mapId);
  }

  getSavedMap(mapId: string) {
    return this.savedMaps().find(map => map.id === mapId) || null;
  }

  deleteSavedMap(mapId: string) {
    this.savedMaps.update(list => list.filter(map => map.id !== mapId));
    if (this.activeMapId() === mapId) {
      this.activeMapId.set(this.savedMaps()[0]?.id || null);
    }
  }

  saveMap(input: Omit<SavedMindMap, 'updatedAt'> & { updatedAt?: string }, options?: { silent?: boolean }) {
    const payload = this.normalizeSavedMap({
      ...input,
      updatedAt: input.updatedAt || new Date().toISOString()
    });

    this.savedMaps.update(existing => {
      const index = existing.findIndex(map => map.id === payload.id);
      if (index === -1) {
        return [payload, ...existing];
      }

      const next = [...existing];
      next[index] = payload;
      return next;
    });

    this.activeMapId.set(payload.id);
    if (!options?.silent) {
      this.ns.show(
        this.ai.currentLanguage() === 'ar' ? 'تم حفظ الخريطة' : 'Mind Map Saved',
        this.ai.currentLanguage() === 'ar'
          ? 'أضيفت الخريطة الذهنية إلى خرائطك المحفوظة.'
          : 'The mind map was added to your saved maps.',
        'success',
        'fa-diagram-project'
      );
    }

    return payload;
  }

  createEmptyMap(context?: MindMapLaunchContext): SavedMindMap {
    const language = context?.language || this.ai.currentLanguage();
    return this.normalizeSavedMap({
      id: crypto.randomUUID(),
      name: context?.mapName || context?.sourceTitle || (language === 'ar' ? 'خريطة ذهنية جديدة' : 'New Mind Map'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sourceText: context?.sourceText || '',
      sourceType: this.normalizeSourceType(context?.sourceType),
      sourceTitle: context?.sourceTitle,
      conversationId: context?.conversationId,
      messageId: context?.messageId,
      language,
      root: null,
      viewMode: 'mindmap',
      customization: { ...DEFAULT_MINDMAP_CUSTOMIZATION },
      progress: this.createProgress(null)
    });
  }

  createProgress(root: MindMapNode | null, currentNodeId?: string | null): MindMapProgress {
    const nodes = root ? this.flattenNodes(root).filter(node => node.type !== 'root') : [];
    const understoodNodeIds = nodes.filter(node => node.reviewState === 'understood').map(node => node.id);
    const reviewNodeIds = nodes.filter(node => node.reviewState === 'review').map(node => node.id);
    return {
      totalNodes: nodes.length,
      understoodNodes: understoodNodeIds.length,
      reviewNodes: reviewNodeIds.length,
      importantNodes: nodes.filter(node => node.isKeyPoint || node.type === 'important').length,
      currentNodeId: currentNodeId ?? nodes[0]?.id ?? null,
      understoodNodeIds,
      reviewNodeIds
    };
  }

  async generateMap(
    context: MindMapLaunchContext,
    mode: MindMapGenerationMode = 'standard'
  ): Promise<{ mapTitle: string; sourceText: string; root: MindMapNode }> {
    const normalizedContext = {
      ...context,
      sourceText: context.sourceText.trim(),
      language: context.language || this.ai.currentLanguage()
    };

    const sourceText = await this.expandSourceIfNeeded(normalizedContext.sourceText, normalizedContext);
    const modeInstruction = this.getModeInstruction(mode, normalizedContext.language);
    const payload = await this.chatJson<GeneratedMindMapPayload>(
      `SOURCE TYPE: ${normalizedContext.sourceType}
SOURCE TITLE: ${normalizedContext.sourceTitle || 'Untitled'}
STUDENT LEVEL: ${this.ai.userLevel()}
SOURCE CONTENT:
${sourceText}`,
      `You are an elite educational mind map generator.
Your task is to convert the provided educational content into a high-quality interactive study mind map.
Return ONLY a JSON object with keys: mapTitle, root.

ROOT RULES:
- root must be a single root node.
- root.type must be "root".
- root.level must be 0.

NODE RULES:
- Each node must contain: id, title, type, level, parentId, order, summary, colorHint, isKeyPoint, children.
- Valid type values: root, main, sub, detail, example, important, definition, warning.
- Main branches should capture the major study axes.
- Sub branches should refine the concept logically.
- Details and examples should be short and helpful.
- Avoid repetition and filler.
- The structure must be useful for learning, revision, and fast recall.
- Keep titles compact and clear.
- Keep summary concise and educational.
- Do not invent facts beyond the source.
- Make the map deeper for university or scientific material and clearer for school-level material.
- ${modeInstruction}
- Respond strictly in ${this.ai.getLanguageName(normalizedContext.language)}.
- JSON only.`
    );

    const root = this.normalizeNode(payload.root || {}, null, 0, 0, true);
    return {
      mapTitle: payload.mapTitle?.trim()
        || normalizedContext.mapName
        || normalizedContext.sourceTitle
        || (normalizedContext.language === 'ar' ? 'خريطة ذهنية ذكية' : 'Smart Mind Map'),
      sourceText,
      root
    };
  }

  toOutlineText(root: MindMapNode | null) {
    if (!root) return '';

    const lines: string[] = [];
    const visit = (node: MindMapNode, depth: number) => {
      const prefix = depth === 0 ? '' : `${'  '.repeat(Math.max(0, depth - 1))}- `;
      lines.push(`${prefix}${node.title}`);
      if (node.summary?.trim()) {
        lines.push(`${'  '.repeat(depth)}${node.summary.trim()}`);
      }
      for (const child of node.children || []) {
        visit(child, depth + 1);
      }
    };

    visit(root, 0);
    return lines.join('\n').trim();
  }

  flattenNodes(root: MindMapNode) {
    const nodes: MindMapNode[] = [];
    const walk = (node: MindMapNode) => {
      nodes.push(node);
      for (const child of node.children || []) {
        walk(child);
      }
    };
    walk(root);
    return nodes;
  }

  cloneMap<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private async expandSourceIfNeeded(sourceText: string, context: MindMapLaunchContext) {
    if (sourceText.length >= 260) {
      return sourceText;
    }

    return this.chatText(
      `Source type: ${context.sourceType}
Source title: ${context.sourceTitle || 'Untitled'}
Short source:
${sourceText}`,
      `Expand this into a stronger study-ready explanation for building a high-quality mind map.
Stay faithful to the source.
Organize concepts, implied connections, and useful structure without adding unsupported facts.
Respond strictly in ${this.ai.getLanguageName(context.language)}.
Return plain text only.`
    );
  }

  private getModeInstruction(mode: MindMapGenerationMode, language: LanguageCode) {
    if (mode === 'simplify') {
      return language === 'ar'
        ? 'اجعل الفروع أقل وعددها أكثر وضوحًا وتركيزًا على الأساسيات.'
        : 'Make the branches fewer, clearer, and more focused on the essentials.';
    }

    if (mode === 'expand') {
      return language === 'ar'
        ? 'اجعل الخريطة أعمق وأكثر تفصيلاً مع أمثلة ونقاط مهمة عند الحاجة.'
        : 'Make the map deeper and more detailed, adding examples and important points where useful.';
    }

    return language === 'ar'
      ? 'أنشئ خريطة متوازنة وقوية للمذاكرة والفهم.'
      : 'Create a balanced, high-value mind map for studying and understanding.';
  }

  private normalizeNode(
    node: Partial<MindMapNode>,
    parentId: string | null,
    level: number,
    order: number,
    forceRoot = false
  ): MindMapNode {
    const type = forceRoot ? 'root' : this.normalizeType(node.type, level);
    const id = String(node.id || crypto.randomUUID());
    const children = Array.isArray(node.children)
      ? node.children
          .map((child, index) => this.normalizeNode(child, id, level + 1, index))
          .slice(0, level === 0 ? 10 : 8)
      : [];

    return {
      id,
      title: String(node.title || '').trim() || this.defaultNodeTitle(type, order + 1),
      type,
      level: forceRoot ? 0 : level,
      parentId,
      order,
      summary: String(node.summary || '').trim() || undefined,
      colorHint: String(node.colorHint || '').trim() || undefined,
      isKeyPoint: Boolean(node.isKeyPoint) || type === 'important',
      children,
      collapsed: Boolean(node.collapsed),
      note: String(node.note || '').trim() || undefined,
      customColor: String(node.customColor || '').trim() || undefined,
      reviewState: node.reviewState === 'understood' || node.reviewState === 'review'
        ? node.reviewState
        : null
    };
  }

  private normalizeType(value: unknown, level: number): MindMapNodeType {
    const raw = String(value || '').trim().toLowerCase();
    const map: Record<string, MindMapNodeType> = {
      root: 'root',
      main: 'main',
      topic: 'main',
      sub: 'sub',
      subtopic: 'sub',
      detail: 'detail',
      example: 'example',
      important: 'important',
      key_point: 'important',
      definition: 'definition',
      warning: 'warning',
      mistake: 'warning'
    };

    if (map[raw]) {
      return map[raw];
    }

    if (level <= 1) return 'main';
    if (level === 2) return 'sub';
    return 'detail';
  }

  private defaultNodeTitle(type: MindMapNodeType, order: number) {
    const isAr = getLanguageDirection(this.ai.currentLanguage()) === 'rtl';
    const labels: Record<MindMapNodeType, string> = {
      root: isAr ? 'الفكرة الرئيسية' : 'Main Idea',
      main: isAr ? `محور ${order}` : `Main Branch ${order}`,
      sub: isAr ? `فرع ${order}` : `Subtopic ${order}`,
      detail: isAr ? `تفصيل ${order}` : `Detail ${order}`,
      example: isAr ? `مثال ${order}` : `Example ${order}`,
      important: isAr ? `نقطة مهمة ${order}` : `Important Point ${order}`,
      definition: isAr ? `تعريف ${order}` : `Definition ${order}`,
      warning: isAr ? `تنبيه ${order}` : `Warning ${order}`
    };
    return labels[type];
  }

  private normalizeSavedMap(map: SavedMindMap): SavedMindMap {
    const language = map.language === 'en' ? 'en' : 'ar';
    const root = map.root ? this.normalizeNode(map.root, null, 0, 0, true) : null;
    const progress = this.createProgress(root, map.progress?.currentNodeId || null);
    return {
      ...map,
      name: map.name.trim() || (language === 'ar' ? 'خريطة ذهنية ذكية' : 'Smart Mind Map'),
      sourceText: map.sourceText.trim(),
      sourceType: this.normalizeSourceType(map.sourceType),
      sourceTitle: map.sourceTitle?.trim() || undefined,
      conversationId: map.conversationId?.trim() || undefined,
      messageId: map.messageId?.trim() || undefined,
      language,
      root,
      viewMode: this.normalizeViewMode(map.viewMode),
      customization: this.normalizeCustomization(map.customization),
      progress: {
        ...progress,
        currentNodeId: progress.currentNodeId
      },
      createdAt: map.createdAt || new Date().toISOString(),
      updatedAt: map.updatedAt || new Date().toISOString()
    };
  }

  private normalizeViewMode(value: unknown): MindMapViewMode {
    return value === 'tree' || value === 'study' || value === 'compact' ? value : 'mindmap';
  }

  private normalizeCustomization(value: MindMapCustomizationSettings | null | undefined): MindMapCustomizationSettings {
    const customization = value || DEFAULT_MINDMAP_CUSTOMIZATION;
    return {
      themeId: this.isThemeId(customization.themeId) ? customization.themeId : DEFAULT_MINDMAP_CUSTOMIZATION.themeId,
      lineStyle:
        customization.lineStyle === 'straight'
          ? 'straight'
          : customization.lineStyle === 'academic' || customization.lineStyle === 'angled'
            ? 'academic'
            : customization.lineStyle === 'neon'
              ? 'neon'
              : 'curved',
      nodeShape: customization.nodeShape === 'glass' || customization.nodeShape === 'pill' || customization.nodeShape === 'academic'
        ? customization.nodeShape
        : 'rounded',
      direction: customization.direction === 'rtl' || customization.direction === 'vertical'
        ? customization.direction
        : 'center',
      spacing: customization.spacing === 'compact' || customization.spacing === 'spacious'
        ? customization.spacing
        : 'balanced',
      nodeSize: customization.nodeSize === 'compact' || customization.nodeSize === 'large'
        ? customization.nodeSize
        : 'balanced',
      backgroundMode: customization.backgroundMode === 'academic_grid'
        ? 'academic_grid'
        : 'minimal',
      showIcons: customization.showIcons !== false,
      visualMode:
        customization.visualMode === 'focus'
        || customization.visualMode === 'branch'
        || customization.visualMode === 'exam'
        || customization.visualMode === 'presentation'
          ? customization.visualMode
          : 'default'
    };
  }

  private isThemeId(value: unknown): value is MindMapThemeId {
    return value === 'classic_academic'
      || value === 'dark_study'
      || value === 'soft_minimal'
      || value === 'neon_focus'
      || value === 'kids_friendly'
      || value === 'medical_clean'
      || value === 'engineering_grid';
  }

  private async chatText(message: string, systemInstruction: string): Promise<string> {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        systemInstruction,
        model: 'gpt-4o-mini'
      })
    });

    const payload = await response.json().catch(() => null) as { text?: string; error?: string } | null;
    if (!response.ok || !payload?.text) {
      throw new Error(payload?.error || `Mind map AI request failed (${response.status})`);
    }

    return payload.text.trim();
  }

  private async chatJson<T>(message: string, systemInstruction: string): Promise<T> {
    const strictInstruction = `${systemInstruction}\nReturn strictly valid JSON with no markdown fences and no extra text.`;
    const text = await this.chatText(message, strictInstruction);
    return JSON.parse(this.extractJsonPayload(text)) as T;
  }

  private extractJsonPayload(raw: string): string {
    const text = raw.trim();
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) return fenced[1].trim();

    const objStart = text.indexOf('{');
    const arrStart = text.indexOf('[');
    const start = objStart >= 0 && arrStart >= 0 ? Math.min(objStart, arrStart) : Math.max(objStart, arrStart);
    if (start < 0) return text;

    const objEnd = text.lastIndexOf('}');
    const arrEnd = text.lastIndexOf(']');
    const end = Math.max(objEnd, arrEnd);
    if (end < start) return text;

    return text.slice(start, end + 1).trim();
  }

  private loadSavedMaps(): SavedMindMap[] {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw) as SavedMindMap[];
      return Array.isArray(parsed) ? parsed.map(map => this.normalizeSavedMap(map)) : [];
    } catch {
      return [];
    }
  }

  private loadActiveMapId() {
    return localStorage.getItem(this.ACTIVE_MAP_KEY);
  }

  private normalizeSourceType(value: unknown): string {
    const normalized = String(value || '').trim();
    if (normalized.replace(/[_\s-]+/g, '').toLowerCase() === 'voicetutor') {
      return 'tutor';
    }
    return normalized || 'manual';
  }
}
