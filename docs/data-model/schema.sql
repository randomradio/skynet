-- MatrixOne Database Schema for AI-Native Development Platform

-- Users table (cross-functional team members)
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    github_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(500),
    role ENUM('engineer', 'pm', 'designer', 'operator') DEFAULT 'engineer',
    preferences JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP
);

-- Repositories table
CREATE TABLE repositories (
    id VARCHAR(36) PRIMARY KEY,
    github_id BIGINT UNIQUE NOT NULL,
    owner VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_private BOOLEAN DEFAULT FALSE,
    default_branch VARCHAR(100) DEFAULT 'main',
    ai_config JSON,
    sync_enabled BOOLEAN DEFAULT TRUE,
    last_synced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY (owner, name)
);

-- Issues table (enhanced from existing)
CREATE TABLE issues (
    id VARCHAR(36) PRIMARY KEY,
    github_id BIGINT UNIQUE NOT NULL,
    number INT NOT NULL,
    repo_owner VARCHAR(100) NOT NULL,
    repo_name VARCHAR(100) NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    state ENUM('open', 'closed') NOT NULL,
    labels JSON,
    assignee_github_id BIGINT,

    -- AI-enriched fields
    ai_type ENUM('bug', 'feature', 'task', 'question'),
    ai_priority ENUM('P0', 'P1', 'P2', 'P3'),
    ai_summary VARCHAR(500),
    ai_tags JSON,
    ai_analysis JSON,
    duplicate_of INT,
    related_issues JSON,
    last_analyzed_at TIMESTAMP,

    -- Sync metadata
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Foreign keys
    FOREIGN KEY (repo_owner, repo_name) REFERENCES repositories(owner, name),

    -- Indexes
    UNIQUE KEY (repo_owner, repo_name, number),
    INDEX idx_state (state),
    INDEX idx_ai_type (ai_type),
    INDEX idx_ai_priority (ai_priority),
    INDEX idx_synced_at (synced_at),
    INDEX idx_duplicate_of (duplicate_of)
);

-- Agent runs table
CREATE TABLE agent_runs (
    id VARCHAR(36) PRIMARY KEY,
    issue_id VARCHAR(36) NOT NULL,
    started_by VARCHAR(36) NOT NULL,
    status ENUM('planning', 'coding', 'testing', 'review', 'cancelled', 'completed', 'failed') NOT NULL,

    -- Execution details
    plan JSON,
    branch VARCHAR(200),
    pr_number INT,

    -- Timeline
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,

    -- Output
    logs JSON,
    artifacts JSON,

    -- Foreign keys
    FOREIGN KEY (issue_id) REFERENCES issues(id),
    FOREIGN KEY (started_by) REFERENCES users(id),

    -- Indexes
    INDEX idx_issue_id (issue_id),
    INDEX idx_status (status),
    INDEX idx_started_at (started_at)
);

-- Discussions table (chat/threads around issues)
CREATE TABLE discussions (
    id VARCHAR(36) PRIMARY KEY,
    issue_id VARCHAR(36) NOT NULL,
    type ENUM('issue_chat', 'plan_review', 'code_review') DEFAULT 'issue_chat',
    participants JSON,
    synthesized_document TEXT,
    last_synthesized_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (issue_id) REFERENCES issues(id),
    INDEX idx_issue_id (issue_id),
    INDEX idx_type (type)
);

-- Messages table (chat messages)
CREATE TABLE messages (
    id VARCHAR(36) PRIMARY KEY,
    discussion_id VARCHAR(36) NOT NULL,
    author_id VARCHAR(36),
    author_type ENUM('user', 'ai') NOT NULL,
    content TEXT NOT NULL,
    ai_context JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (discussion_id) REFERENCES discussions(id),
    INDEX idx_discussion_id (discussion_id),
    INDEX idx_created_at (created_at)
);

-- Activity log (for cross-functional visibility)
CREATE TABLE activity_log (
    id VARCHAR(36) PRIMARY KEY,
    type ENUM(
        'issue_created',
        'issue_updated',
        'issue_closed',
        'agent_started',
        'agent_completed',
        'agent_failed',
        'pr_created',
        'pr_merged',
        'plan_generated',
        'plan_finalized',
        'comment_added'
    ) NOT NULL,

    -- Context
    repo_owner VARCHAR(100),
    repo_name VARCHAR(100),
    issue_number INT,
    agent_run_id VARCHAR(36),

    -- Actor
    actor_id VARCHAR(36),
    actor_type ENUM('user', 'ai', 'system') NOT NULL,

    -- Content
    title VARCHAR(200) NOT NULL,
    description TEXT,
    metadata JSON,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Indexes
    INDEX idx_type (type),
    INDEX idx_repo (repo_owner, repo_name),
    INDEX idx_issue (repo_owner, repo_name, issue_number),
    INDEX idx_actor (actor_id),
    INDEX idx_created_at (created_at)
);

-- Webhook events log (for debugging and replay)
CREATE TABLE webhook_events (
    id VARCHAR(36) PRIMARY KEY,
    source VARCHAR(50) NOT NULL,  -- 'github', etc.
    event_type VARCHAR(50) NOT NULL,
    payload JSON NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_source_type (source, event_type),
    INDEX idx_processed (processed),
    INDEX idx_created_at (created_at)
);

-- Code context cache (for AI code search results)
CREATE TABLE code_context_cache (
    id VARCHAR(36) PRIMARY KEY,
    repo_owner VARCHAR(100) NOT NULL,
    repo_name VARCHAR(100) NOT NULL,
    issue_number INT NOT NULL,
    query_hash VARCHAR(64) NOT NULL,  -- Hash of the search query
    file_path VARCHAR(500) NOT NULL,
    line_start INT,
    line_end INT,
    snippet TEXT,
    relevance_score FLOAT,
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_issue (repo_owner, repo_name, issue_number),
    INDEX idx_query_hash (query_hash),
    INDEX idx_fetched_at (fetched_at)
);

-- Vector embeddings for semantic search (if using)
-- Note: MatrixOne may have specific vector types; adjust accordingly
CREATE TABLE issue_embeddings (
    id VARCHAR(36) PRIMARY KEY,
    issue_id VARCHAR(36) NOT NULL,
    embedding_type ENUM('title', 'body', 'summary') NOT NULL,
    embedding JSON,  -- Or specific vector type if supported
    model VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (issue_id) REFERENCES issues(id),
    UNIQUE KEY (issue_id, embedding_type),
    INDEX idx_issue_id (issue_id)
);
