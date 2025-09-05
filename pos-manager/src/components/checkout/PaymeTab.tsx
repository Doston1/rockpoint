import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import { useState } from 'react';
import { apiService } from '../../services/api';

interface PaymeTabProps {
  exactRemainingAmount: number;
  onProcessPayment: (method: string, amount: number) => void;
  terminalId?: string;
}

export const PaymeTab: React.FC<PaymeTabProps> = ({
  exactRemainingAmount,
  onProcessPayment,
  terminalId,
}) => {
  const [paymeProcessing, setPaymeProcessing] = useState(false);
  const [paymeError, setPaymeError] = useState('');
  const [paymeQrCode, setPaymeQrCode] = useState('');

  const handlePaymePayment = async () => {
    setPaymeProcessing(true);
    setPaymeError('');

    try {
      const response = await apiService.createPaymeQRReceipt({
        amount_uzs: exactRemainingAmount,
        description: `POS Payment - PayMe`,
        employee_id: 'cashier_demo', // TODO: Get from auth context
        terminal_id: terminalId || 'POS001',
        pos_transaction_id: `pos_${Date.now()}`, // TODO: Link to actual transaction
      });

      if (response.success && response.data) {
        setPaymeQrCode(response.data.data.qr_code_data || response.data.data.payment_url || 'QR Code Generated');
        // Auto-process the payment after successful QR generation
        onProcessPayment('payme_qr', exactRemainingAmount);
      } else {
        setPaymeError(response.error || response.message || 'Failed to create PayMe QR code');
      }
    } catch (error) {
      console.error('PayMe payment error:', error);
      setPaymeError('Network error. Please try again.');
    } finally {
      setPaymeProcessing(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom color="primary" fontWeight="bold">
        💳 PayMe Payment
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={3}>
        Generate PayMe QR code for payment
      </Typography>
      
      {paymeError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {paymeError}
        </Alert>
      )}
      
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" color="text.secondary" mb={1}>
          Payment Amount:
        </Typography>
        <Typography variant="h2" color="primary" fontWeight="bold" sx={{ mb: 3 }}>
          ${exactRemainingAmount.toFixed(2)}
        </Typography>
        
        {!paymeQrCode && !paymeProcessing && (
          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handlePaymePayment}
            sx={{ 
              py: 3, 
              fontSize: '1.2rem',
              fontWeight: 'bold',
              mb: 3,
              bgcolor: '#00b4d8',
              '&:hover': { bgcolor: '#0096c7' }
            }}
          >
            💳 Generate PayMe QR Code
          </Button>
        )}
        
        {paymeProcessing && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress size={60} sx={{ mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Generating PayMe QR Code...
            </Typography>
          </Box>
        )}
        
        {paymeQrCode && (
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography variant="h6" color="success.main" gutterBottom>
              ✅ PayMe QR Code Generated!
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
                {paymeQrCode}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Customer should scan this QR code with PayMe app to complete payment
            </Typography>
          </Box>
        )}
      </Box>
      
      <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block', textAlign: 'center' }}>
        Powered by PayMe • Secure payment processing
      </Typography>
    </Box>
  );
};
