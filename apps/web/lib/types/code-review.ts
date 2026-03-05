export interface ReviewFinding {
  id: string;
  file: string;
  lineStart: number;
  lineEnd: number;
  severity: "info" | "warning" | "error";
  category: string;
  message: string;
  suggestedFix?: SuggestedFix;
}

export interface SuggestedFix {
  id: string;
  findingId: string;
  file: string;
  originalCode: string;
  proposedCode: string;
  lineStart: number;
  lineEnd: number;
  explanation: string;
}

export interface ReviewFeedback {
  id: string;
  agentRunId: string;
  findingId: string;
  suggestedFixId?: string;
  action: "approve" | "reject" | "comment";
  comment?: string;
  createdBy: string;
  createdAt: string;
}

export interface StructuredReviewArtifact {
  type: "structured_review";
  reviewSummary: string;
  overallAssessment: "approve" | "request_changes" | "comment";
  findings: ReviewFinding[];
  metadata: {
    filesReviewed: number;
    totalFindings: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
  };
}

export interface CodeContextSnippet {
  file: string;
  lineStart: number;
  lineEnd: number;
  content: string;
  language: string;
  relevanceReason: string;
}
