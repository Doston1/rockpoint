import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import { useState } from 'react';
import { apiService } from '../../services/api';

interface ClickPassTabProps {
  exactRemainingAmount: number;
  onProcessPayment: (method: 'click_pass', amount: number) => void;
  terminalId?: string;
}

export const ClickPassTab: React.FC<ClickPassTabProps> = ({
  exactRemainingAmount,
  onProcessPayment,
  terminalId,
}) => {
  const [clickPassQrCode, setClickPassQrCode] = useState('');
  const [clickPassProcessing, setClickPassProcessing] = useState(false);
  const [clickPassError, setClickPassError] = useState('');

  const handleClickPassPayment = async () => {
    setClickPassProcessing(true);
    setClickPassError('');

    try {
      const response = await apiService.processClickPassPayment({
        amount_uzs: Math.round(exactRemainingAmount * 12800), // Convert USD to UZS (approximate rate)
        otp_data: 'POS_PAYMENT', // Static OTP data for POS payments
        employee_id: 'cashier_' + (terminalId || 'POS001'),
        terminal_id: terminalId || 'POS001',
        pos_transaction_id: `pos_${Date.now()}`,
        cashbox_code: `RockPoint_${terminalId || 'POS001'}`
      });

      if (response.success && response.data?.success && response.data.data?.click_transaction_id) {
        const transactionId = response.data.data.click_transaction_id;
        setClickPassQrCode(transactionId);
        // Start polling for payment status
        setTimeout(() => checkClickPassStatus(transactionId), 2000);
      } else {
        setClickPassError(response.error || response.data?.error || 'Failed to create Click Pass payment');
      }
    } catch (error) {
      console.error('Click Pass error:', error);
      setClickPassError('Network error. Please try again.');
    } finally {
      setClickPassProcessing(false);
    }
  };

  const checkClickPassStatus = async (transactionId: string) => {
    try {
      const response = await apiService.getClickPassStatus(transactionId);
      
      if (response.success && response.data?.status === 'CONFIRMED') {
        onProcessPayment('click_pass', exactRemainingAmount);
        setClickPassQrCode('');
        setClickPassError('');
      } else if (response.data?.status === 'FAILED' || response.data?.status === 'CANCELLED') {
        setClickPassError('Payment was cancelled or failed');
      } else {
        // Continue polling if payment is still pending
        setTimeout(() => checkClickPassStatus(transactionId), 3000);
      }
    } catch (error) {
      console.error('Click Pass status check error:', error);
      setTimeout(() => checkClickPassStatus(transactionId), 5000);
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom color="primary" fontWeight="bold">
        💸 Click Pass Payment
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={3}>
        Generate Click Pass QR code for payment
      </Typography>
      
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" color="text.secondary" mb={1}>
          Payment Amount:
        </Typography>
        <Typography variant="h2" color="primary" fontWeight="bold" sx={{ mb: 3 }}>
          ${exactRemainingAmount.toFixed(2)}
        </Typography>
        
        {!clickPassQrCode && !clickPassProcessing && (
          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleClickPassPayment}
            sx={{ 
              py: 3, 
              fontSize: '1.2rem',
              fontWeight: 'bold',
              mb: 3,
              bgcolor: '#ff6b35',
              '&:hover': { bgcolor: '#e55a2b' }
            }}
          >
            💸 Generate Click Pass QR Code
          </Button>
        )}
        
        {clickPassProcessing && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress size={60} sx={{ mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Generating Click Pass QR Code...
            </Typography>
          </Box>
        )}
        
        {clickPassQrCode && (
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography variant="h6" color="success.main" gutterBottom>
              ✅ Click Pass QR Code Generated!
            </Typography>
            <Box sx={{ 
              p: 3, 
              border: 2, 
              borderColor: 'success.main', 
              borderRadius: 2, 
              bgcolor: 'success.light',
              mb: 2
            }}>
              <Typography variant="body2" sx={{ 
                fontFamily: 'monospace', 
                wordBreak: 'break-all',
                fontSize: '0.9rem',
                color: 'success.dark'
              }}>
                {clickPassQrCode}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Customer should scan this QR code with Click app to complete payment
            </Typography>
          </Box>
        )}
        
        {clickPassError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {clickPassError}
          </Alert>
        )}
      </Box>
      
      <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block', textAlign: 'center' }}>
        Powered by Click • Secure payment processing
      </Typography>
    </Box>
  );
};
