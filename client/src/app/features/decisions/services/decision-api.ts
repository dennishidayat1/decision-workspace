import { inject, Service, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CreateDecisionRequest } from '../models/create-decision-request';
import { Decision } from '../models/decision';
import { environment } from '../../../../environments/environment';
import { DecisionOption } from '../models/decision-option';
import { CreateDecisionOptionRequest } from '../models/create-decision-option-request';
import { CreateDecisionOptionAttributeRequest } from '../models/create-decision-option-attribute-request';
import { DecisionOptionAttribute } from '../models/decision-option-attribute';
import { CreateCriterionRequest } from '../models/create-criterion-request';
import { Criterion } from '../models/criterion';
import { CreateOptionScoreRequest } from '../models/create-option-score-request';
import { OptionScore } from '../models/option-score';
import { DecisionWorkspaceResponse } from '../models/decision-workspace-response';
import { CreateDecisionWorkspaceRequest } from '../models/create-decision-workspace-request';
import { SaveCriterionRequest } from '../models/save-criterion-request';
import { PreviewMarketplaceLinkRequest } from '../models/preview-marketplace-link-request';
import { MarketplaceLinkPreviewResponse } from '../models/marketplace-link-preview-response';

@Service()
export class DecisionApi {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = `${environment.apiUrl}`;
  private readonly failedImages = signal<ReadonlySet<string>>(new Set());

  // The editable thumbnail takes precedence; ImageUrl is the import fallback.
  getOptionImageUrl(option: DecisionOption): string | null {
    return this.getMarketplaceImageUrl(option.thumbnailUrl?.trim())
      ?? this.getMarketplaceImageUrl(option.imageUrl?.trim());
  }

  clearImageFailures(...imageUrls: (string | null | undefined)[]): void {
    const cleared = new Set(imageUrls.filter((url): url is string => !!url));
    for (const url of [...cleared]) {
      cleared.add(`${this.apiUrl}/marketplace/image?url=${encodeURIComponent(url)}`);
    }
    this.failedImages.update(urls => new Set([...urls].filter(url => !cleared.has(url))));
  }

  supportsMarketplaceSource(sourceUrl: string | null | undefined): boolean {
    try {
      const url = new URL(sourceUrl ?? '');
      return url.protocol === 'https:' && !url.username && !url.password &&
        ['tokopedia.com', 'shopee.co.id', 'shp.ee'].some(domain =>
          url.hostname === domain || url.hostname.endsWith(`.${domain}`));
    } catch { return false; }
  }

  refreshOptionImage(decisionId: string, optionId: string, expectedUpdatedAt: string, replaceThumbnail = false) {
    return this.http.post<DecisionOption>(
      `${this.apiUrl}/decisions/${decisionId}/options/${optionId}/refresh-image`,
      { expectedUpdatedAt, replaceThumbnail },
    );
  }

  markImageFailed(imageUrl: string): void {
    this.failedImages.update(urls => new Set([...urls, imageUrl]));
  }

  createDecision(request: CreateDecisionRequest) {
    return this.http.post<Decision>(
      `${this.apiUrl}/decisions`,
      request,
    );
  }

  getAllDecisions() {
    return this.http.get<Decision[]>(
      `${this.apiUrl}/decisions`,
    );
  }

  getDecisionById(id: string) {
    return this.http.get<Decision>(
      `${this.apiUrl}/decisions/${id}`,
    );
  }

  getDecisionWorkspace(id: string) {
    return this.http.get<DecisionWorkspaceResponse>(
      `${this.apiUrl}/decisions/${id}/workspace`,
    );
  }

  createDecisionWorkspace(request: CreateDecisionWorkspaceRequest) {
    return this.http.post<Decision>(
      `${this.apiUrl}/decisions/workspace`,
      request,
    );
  }

  updateDecision(
    id: string,
    request: CreateDecisionRequest,
  ) {
    return this.http.put<Decision>(
      `${this.apiUrl}/decisions/${id}`,
      request,
    );
  }

  deleteDecision(
    id: string,
  ) {
    return this.http.delete<void>(
      `${this.apiUrl}/decisions/${id}`,
    );
  }

  getDecisionOptions(decisionId: string) {
    return this.http.get<DecisionOption[]>(
      `${this.apiUrl}/decisions/${decisionId}/options`,
    );
  }

  createDecisionOption(decisionId: string, request: CreateDecisionOptionRequest) {
    return this.http.post<DecisionOption>(
      `${this.apiUrl}/decisions/${decisionId}/options`,
      request,
    );
  }

  updateDecisionOption(
    decisionId: string,
    decisionOptionId: string,
    request: CreateDecisionOptionRequest,
  ) {
    return this.http.put<DecisionOption>(
      `${this.apiUrl}/decisions/${decisionId}/options/${decisionOptionId}`,
      request,
    );
  }

  getDecisionOptionAttributes(decisionId: string, decisionOptionId: string) {
    return this.http.get<DecisionOptionAttribute[]>(
      `${this.apiUrl}/decisions/${decisionId}/options/${decisionOptionId}/attributes`,
    );
  }

  createDecisionOptionAttribute(decisionId: string, decisionOptionId: string, request: CreateDecisionOptionAttributeRequest) {
    return this.http.post<DecisionOptionAttribute>(
      `${this.apiUrl}/decisions/${decisionId}/options/${decisionOptionId}/attributes`,
      request,
    );
  }

  updateDecisionOptionAttributes(
    decisionId: string,
    decisionOptionId: string,
    requests: CreateDecisionOptionAttributeRequest[],
  ) {
    return this.http.put<DecisionOptionAttribute[]>(
      `${this.apiUrl}/decisions/${decisionId}/options/${decisionOptionId}/attributes`,
      requests,
    );
  }

  deleteDecisionOption(
    decisionId: string,
    decisionOptionId: string,
  ) {
    return this.http.delete<void>(
      `${this.apiUrl}/decisions/${decisionId}/options/${decisionOptionId}`,
    );
  }

  getCriteria(decisionId: string) {
    return this.http.get<Criterion[]>(
      `${this.apiUrl}/decisions/${decisionId}/criteria`,
    );
  }

  createCriterion(decisionId: string, request: CreateCriterionRequest) {
    return this.http.post<Criterion>(
      `${this.apiUrl}/decisions/${decisionId}/criteria`,
      request,
    );
  }

  updateCriterion(
    decisionId: string,
    criterionId: string,
    request: CreateCriterionRequest,
  ) {
    return this.http.put<Criterion>(
      `${this.apiUrl}/decisions/${decisionId}/criteria/${criterionId}`,
      request,
    );
  }

  deleteCriterion(
    decisionId: string,
    criterionId: string,
  ) {
    return this.http.delete<void>(
      `${this.apiUrl}/decisions/${decisionId}/criteria/${criterionId}`,
    );
  }

  saveCriteria(
    decisionId: string,
    requests: SaveCriterionRequest[],
  ) {
    return this.http.put<Criterion[]>(
      `${this.apiUrl}/decisions/${decisionId}/criteria`,
      requests,
    );
  }

  getOptionScores(decisionOptionId: string) {
    return this.http.get<OptionScore[]>(
      `${this.apiUrl}/decision-options/${decisionOptionId}/scores`
    )
  }

  createOptionScore(decisionOptionId: string, request: CreateOptionScoreRequest) {
    return this.http.post<OptionScore>(
      `${this.apiUrl}/decision-options/${decisionOptionId}/scores`,
      request
    )
  }

  previewMarketplaceLink(request: PreviewMarketplaceLinkRequest) {
    return this.http.post<MarketplaceLinkPreviewResponse>(
      `${this.apiUrl}/marketplace-links/preview`,
      request,
    );
  }

  getMarketplaceImageUrl(imageUrl: string | null | undefined): string | null {
    if (!imageUrl) {
      return null;
    }

    try {
      const url = new URL(imageUrl);

      const isTokopediaImage =
        url.hostname === 'tokopedia-static.net' ||
        url.hostname.endsWith('.tokopedia-static.net');

      const resolvedUrl = isTokopediaImage ? (
        `${this.apiUrl}/marketplace/image` +
        `?url=${encodeURIComponent(imageUrl)}`
      ) : imageUrl;
      return this.failedImages().has(resolvedUrl) ? null : resolvedUrl;
    } catch {
      return this.failedImages().has(imageUrl) ? null : imageUrl;
    }
  }
}
