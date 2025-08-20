-- Uzum Bank FastPay Integration Tables
-- PostgreSQL 14+
-- This file contains all tables and indexes for Uzum Bank FastPay integration

-- =================================================================
-- UZUM BANK FASTPAY TABLES
-- =================================================================

-- Update existing payments table to include 'fastpay' payment method
-- This modifies the CHECK constraint to allow FastPay as a payment method
DO $$ 
BEGIN
    -- Drop the existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE table_name = 'payments' AND constraint_name LIKE '%method%'
    ) THEN
        ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_method_check;
    END IF;
    
    -- Add the new constraint with 'fastpay' included
    ALTER TABLE payments ADD CONSTRAINT payments_method_check 
        CHECK (method IN ('cash', 'card', 'digital_wallet', 'store_credit', 'fastpay'));
END $$;

-- Uzum Bank Configuration table to store API credentials
CREATE TABLE IF NOT EXISTS uzum_bank_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    description TEXT,
    is_encrypted BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FastPay transactions table to track all payment attempts
CREATE TABLE IF NOT EXISTS uzum_fastpay_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Transaction identifiers
    transaction_id UUID NOT NULL, -- UUID for each payment attempt
    order_id VARCHAR(255) UNIQUE NOT NULL, -- Unique order identifier in our system
    pos_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL, -- Link to main transaction
    
    -- Payment details
    amount BIGINT NOT NULL, -- Amount in tiyin (1 UZS = 100 tiyin)
    amount_uzs DECIMAL(15,2) NOT NULL, -- Amount in UZS for easy reading
    cashbox_code VARCHAR(100) NOT NULL, -- Partner's cash register code
    otp_data VARCHAR(255) NOT NULL, -- QR code data from customer
    
    -- Uzum Bank identifiers
    service_id BIGINT NOT NULL, -- Uzum Bank service identifier
    payment_id VARCHAR(255), -- Uzum Bank payment identifier (returned on success)
    
    -- Request/Response tracking
    request_payload JSONB NOT NULL, -- Full request sent to Uzum Bank
    response_payload JSONB, -- Full response from Uzum Bank
    authorization_header TEXT NOT NULL, -- Authorization header used
    
    -- Status tracking
    status VARCHAR(50) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'processing', 'success', 'failed', 'cancelled', 'reversed')),
    error_code INTEGER DEFAULT 0, -- Uzum Bank error code (0 = success)
    error_message TEXT, -- Uzum Bank error message
    
    -- Timestamps
    initiated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Employee and terminal tracking
    employee_id VARCHAR(50) NOT NULL,
    terminal_id VARCHAR(100) NOT NULL,
    
    -- Additional metadata
    client_phone_number VARCHAR(20), -- Customer phone from Uzum Bank response
    operation_time VARCHAR(50), -- Operation timestamp from Uzum Bank
    retry_count INTEGER DEFAULT 0, -- Number of retry attempts
    timeout_occurred BOOLEAN DEFAULT false, -- Whether request timed out
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FastPay fiscalization table to track fiscal receipt submissions
CREATE TABLE IF NOT EXISTS uzum_fastpay_fiscalization (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fastpay_transaction_id UUID NOT NULL REFERENCES uzum_fastpay_transactions(id) ON DELETE CASCADE,
    payment_id VARCHAR(255) NOT NULL, -- Uzum Bank payment identifier
    service_id BIGINT NOT NULL,
    fiscal_url TEXT NOT NULL, -- URL to fiscal receipt
    
    -- Request/Response tracking
    request_payload JSONB NOT NULL,
    response_payload JSONB,
    
    -- Status tracking
    status VARCHAR(50) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'success', 'failed')),
    error_code INTEGER DEFAULT 0,
    error_message TEXT,
    
    -- Timestamps
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FastPay reversals table to track payment cancellations
CREATE TABLE IF NOT EXISTS uzum_fastpay_reversals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fastpay_transaction_id UUID NOT NULL REFERENCES uzum_fastpay_transactions(id) ON DELETE CASCADE,
    original_order_id VARCHAR(255) NOT NULL, -- Original order ID being reversed
    payment_id VARCHAR(255) NOT NULL, -- Uzum Bank payment identifier
    service_id BIGINT NOT NULL,
    
    -- Request/Response tracking
    request_payload JSONB NOT NULL,
    response_payload JSONB,
    
    -- Status tracking
    status VARCHAR(50) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'success', 'failed')),
    error_code INTEGER DEFAULT 0,
    error_message TEXT,
    
    -- Reason for reversal
    reversal_reason TEXT NOT NULL,
    requested_by VARCHAR(50) NOT NULL, -- Employee who requested reversal
    
    -- Timestamps
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FastPay audit log for compliance and debugging
CREATE TABLE IF NOT EXISTS uzum_fastpay_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fastpay_transaction_id UUID REFERENCES uzum_fastpay_transactions(id) ON DELETE SET NULL,
    
    -- Action details
    action VARCHAR(50) NOT NULL 
        CHECK (action IN ('payment_initiated', 'payment_completed', 'payment_failed', 
                         'fiscalization_sent', 'reversal_requested', 'status_checked', 'error_occurred')),
    details JSONB, -- Additional action-specific details
    
    -- Context
    employee_id VARCHAR(50),
    terminal_id VARCHAR(100),
    ip_address INET,
    user_agent TEXT,
    
    -- Request details (for API calls)
    http_method VARCHAR(10),
    endpoint VARCHAR(255),
    request_headers JSONB,
    response_status INTEGER,
    response_time_ms INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =================================================================
-- INDEXES FOR PERFORMANCE
-- =================================================================

-- Uzum Bank config indexes
CREATE INDEX IF NOT EXISTS idx_uzum_bank_config_key ON uzum_bank_config(config_key);
CREATE INDEX IF NOT EXISTS idx_uzum_bank_config_active ON uzum_bank_config(is_active);

-- FastPay transactions indexes
CREATE INDEX IF NOT EXISTS idx_uzum_fastpay_order_id ON uzum_fastpay_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_uzum_fastpay_payment_id ON uzum_fastpay_transactions(payment_id);
CREATE INDEX IF NOT EXISTS idx_uzum_fastpay_pos_transaction ON uzum_fastpay_transactions(pos_transaction_id);
CREATE INDEX IF NOT EXISTS idx_uzum_fastpay_status ON uzum_fastpay_transactions(status);
CREATE INDEX IF NOT EXISTS idx_uzum_fastpay_employee ON uzum_fastpay_transactions(employee_id);
CREATE INDEX IF NOT EXISTS idx_uzum_fastpay_terminal ON uzum_fastpay_transactions(terminal_id);
CREATE INDEX IF NOT EXISTS idx_uzum_fastpay_initiated_at ON uzum_fastpay_transactions(initiated_at);
CREATE INDEX IF NOT EXISTS idx_uzum_fastpay_completed_at ON uzum_fastpay_transactions(completed_at);
CREATE INDEX IF NOT EXISTS idx_uzum_fastpay_error_code ON uzum_fastpay_transactions(error_code);

-- FastPay fiscalization indexes
CREATE INDEX IF NOT EXISTS idx_uzum_fiscalization_transaction ON uzum_fastpay_fiscalization(fastpay_transaction_id);
CREATE INDEX IF NOT EXISTS idx_uzum_fiscalization_payment_id ON uzum_fastpay_fiscalization(payment_id);
CREATE INDEX IF NOT EXISTS idx_uzum_fiscalization_status ON uzum_fastpay_fiscalization(status);
CREATE INDEX IF NOT EXISTS idx_uzum_fiscalization_submitted_at ON uzum_fastpay_fiscalization(submitted_at);

-- FastPay reversals indexes
CREATE INDEX IF NOT EXISTS idx_uzum_reversals_transaction ON uzum_fastpay_reversals(fastpay_transaction_id);
CREATE INDEX IF NOT EXISTS idx_uzum_reversals_order_id ON uzum_fastpay_reversals(original_order_id);
CREATE INDEX IF NOT EXISTS idx_uzum_reversals_payment_id ON uzum_fastpay_reversals(payment_id);
CREATE INDEX IF NOT EXISTS idx_uzum_reversals_status ON uzum_fastpay_reversals(status);
CREATE INDEX IF NOT EXISTS idx_uzum_reversals_requested_by ON uzum_fastpay_reversals(requested_by);
CREATE INDEX IF NOT EXISTS idx_uzum_reversals_requested_at ON uzum_fastpay_reversals(requested_at);

-- FastPay audit log indexes
CREATE INDEX IF NOT EXISTS idx_uzum_audit_transaction ON uzum_fastpay_audit_log(fastpay_transaction_id);
CREATE INDEX IF NOT EXISTS idx_uzum_audit_action ON uzum_fastpay_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_uzum_audit_employee ON uzum_fastpay_audit_log(employee_id);
CREATE INDEX IF NOT EXISTS idx_uzum_audit_terminal ON uzum_fastpay_audit_log(terminal_id);
CREATE INDEX IF NOT EXISTS idx_uzum_audit_created_at ON uzum_fastpay_audit_log(created_at);

-- =================================================================
-- TRIGGERS
-- =================================================================

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_uzum_bank_config_updated_at BEFORE UPDATE ON uzum_bank_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_uzum_fastpay_transactions_updated_at BEFORE UPDATE ON uzum_fastpay_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =================================================================
-- INITIAL CONFIGURATION DATA
-- =================================================================

-- Insert default configuration entries (values should be set via environment variables)
INSERT INTO uzum_bank_config (config_key, config_value, description, is_encrypted) VALUES
('merchant_service_user_id', 'PLACEHOLDER', 'Cash register ID provided by Uzum Bank', false),
('secret_key', 'PLACEHOLDER', 'Secret key provided by Uzum Bank for authentication', true),
('service_id', 'PLACEHOLDER', 'Branch/service identifier provided by Uzum Bank', false),
('api_base_url', 'https://mobile.apelsin.uz', 'Uzum Bank FastPay API base URL', false),
('request_timeout_ms', '15000', 'HTTP request timeout in milliseconds', false),
('cashbox_code_prefix', 'RockPoint', 'Prefix for cash register codes', false),
('max_retry_attempts', '3', 'Maximum number of retry attempts for failed payments', false),
('enable_logging', 'true', 'Enable detailed logging for debugging', false)
ON CONFLICT (config_key) DO NOTHING;

-- =================================================================
-- VIEWS FOR REPORTING
-- =================================================================

-- FastPay transaction summary view
CREATE OR REPLACE VIEW uzum_fastpay_transaction_summary AS
SELECT 
    ft.id,
    ft.order_id,
    ft.transaction_id,
    ft.amount_uzs,
    ft.status,
    ft.error_code,
    ft.error_message,
    ft.client_phone_number,
    ft.employee_id,
    ft.terminal_id,
    ft.initiated_at,
    ft.completed_at,
    e.name as employee_name,
    t.total_amount as pos_total_amount,
    t.status as pos_status,
    CASE 
        WHEN ft.completed_at IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (ft.completed_at - ft.initiated_at))::INTEGER
        ELSE NULL 
    END as processing_time_seconds
FROM uzum_fastpay_transactions ft
LEFT JOIN employees e ON ft.employee_id = e.employee_id
LEFT JOIN transactions t ON ft.pos_transaction_id = t.id
ORDER BY ft.initiated_at DESC;

-- Daily FastPay stats view
CREATE OR REPLACE VIEW uzum_fastpay_daily_stats AS
SELECT 
    DATE(initiated_at) as transaction_date,
    COUNT(*) as total_attempts,
    COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_payments,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments,
    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_payments,
    COUNT(CASE WHEN status = 'reversed' THEN 1 END) as reversed_payments,
    SUM(CASE WHEN status = 'success' THEN amount_uzs ELSE 0 END) as total_successful_amount,
    AVG(CASE WHEN completed_at IS NOT NULL THEN 
        EXTRACT(EPOCH FROM (completed_at - initiated_at)) 
    END) as avg_processing_time_seconds,
    COUNT(CASE WHEN error_code > 0 THEN 1 END) as error_count
FROM uzum_fastpay_transactions
GROUP BY DATE(initiated_at)
ORDER BY transaction_date DESC;

-- =================================================================
-- COMMENTS FOR DOCUMENTATION
-- =================================================================

COMMENT ON TABLE uzum_bank_config IS 'Configuration settings for Uzum Bank FastPay integration';
COMMENT ON TABLE uzum_fastpay_transactions IS 'Main table tracking all FastPay payment transactions';
COMMENT ON TABLE uzum_fastpay_fiscalization IS 'Tracking fiscal receipt submissions to Uzum Bank';
COMMENT ON TABLE uzum_fastpay_reversals IS 'Tracking payment cancellations/reversals';
COMMENT ON TABLE uzum_fastpay_audit_log IS 'Comprehensive audit trail for compliance and debugging';

COMMENT ON COLUMN uzum_fastpay_transactions.amount IS 'Payment amount in tiyin (1 UZS = 100 tiyin)';
COMMENT ON COLUMN uzum_fastpay_transactions.otp_data IS 'QR code data scanned from customer device (min 40 chars)';
COMMENT ON COLUMN uzum_fastpay_transactions.cashbox_code IS 'Partner-defined cash register identifier';
COMMENT ON COLUMN uzum_fastpay_transactions.authorization_header IS 'Computed authorization header for API request';
COMMENT ON COLUMN uzum_fastpay_transactions.retry_count IS 'Number of automatic retry attempts';

-- =================================================================
-- SUMMARY
-- =================================================================

-- This schema adds 5 tables for Uzum Bank FastPay integration:
-- 1. uzum_bank_config - API credentials and configuration
-- 2. uzum_fastpay_transactions - Main payment transaction tracking
-- 3. uzum_fastpay_fiscalization - Fiscal receipt submissions
-- 4. uzum_fastpay_reversals - Payment cancellations
-- 5. uzum_fastpay_audit_log - Comprehensive audit trail

-- Features:
-- - Complete transaction lifecycle tracking
-- - Comprehensive audit logging for compliance
-- - Error handling and retry mechanisms
-- - Performance monitoring with timing metrics
-- - Reporting views for business intelligence
-- - Proper indexing for query performance
-- - Foreign key relationships for data integrity
