import { QrCodeScanner } from '@mui/icons-material';
import { Alert, Box, Button, CircularProgress, TextField, Typography } from '@mui/material';
import { useState } from 'react';

interface UzumFastPayTabProps {
  exactRemainingAmount: number;
  remainingAmount: number;
  onProcessPayment: (method: 'fastpay', amount: number) => void;
  cartItems?: any[];
  terminalId?: string;
}

export const UzumFastPayTab: React.FC<UzumFastPayTabProps> = ({
  exactRemainingAmount,
  remainingAmount,
  onProcessPayment,
  cartItems = [],
  terminalId,
}) => {
  const [fastPayQrCode, setFastPayQrCode] = useState('');
  const [fastPayProcessing, setFastPayProcessing] = useState(false);
  const [fastPayError, setFastPayError] = useState('');

  const processFastPayPayment = async () => {
    if (!fastPayQrCode || fastPayQrCode.length < 40) {
      setFastPayError('QR code must be at least 40 characters long');
      return;
    }

    setFastPayProcessing(true);
    setFastPayError('');

    try {
      // Call FastPay API
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/fastpay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          qrCode: fastPayQrCode,
          amount: exactRemainingAmount,
          description: `POS Payment - ${cartItems?.length || 0} items`,
          cashboxCode: `RockPoint_${terminalId || 'POS001'}`,
        }),
      });

      const result = await response.json();

      if (result.success && result.data.status === 'success') {
        // Payment successful
        onProcessPayment('fastpay', exactRemainingAmount);
        setFastPayQrCode('');
        setFastPayProcessing(false);
        setFastPayError('');
      } else {
        setFastPayError(result.error || result.data.error_message || 'FastPay payment failed');
      }
    } catch (error) {
      console.error('FastPay error:', error);
      setFastPayError('Network error. Please try again.');
    } finally {
      setFastPayProcessing(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom color="primary" fontWeight="bold">
        🏦 Uzum Bank FastPay
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={3}>
        Scan the QR code from customer's Uzum Bank app to process payment
      </Typography>
      
      {fastPayError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {fastPayError}
        </Alert>
      )}
      
      <TextField
        fullWidth
        label="🔗 Customer QR Code Data"
        value={fastPayQrCode}
        onChange={(e) => {
          setFastPayQrCode(e.target.value);
          setFastPayError('');
        }}
        placeholder="Scan or paste QR code from customer's Uzum Bank app"
        multiline
        rows={3}
        sx={{ 
          mb: 3,
          '& .MuiInputBase-input': {
            fontSize: '1.1rem',
            fontFamily: 'monospace'
          }
        }}
        helperText={`QR code must be at least 40 characters. Current: ${fastPayQrCode.length}`}
        error={fastPayQrCode.length > 0 && fastPayQrCode.length < 40}
      />
      
      <Box sx={{ 
        mb: 3, 
        p: 3, 
        bgcolor: 'info.light', 
        borderRadius: 2,
        border: 1,
        borderColor: 'info.main'
      }}>
        <Typography variant="h6" color="info.main" gutterBottom>
          💰 Payment Amount: ${exactRemainingAmount.toFixed(2)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          FastPay will process the exact remaining amount
        </Typography>
      </Box>
      
      <Button
        fullWidth
        variant="contained"
        size="large"
        disabled={
          fastPayProcessing || 
          !fastPayQrCode || 
          fastPayQrCode.length < 40 || 
          remainingAmount <= 0
        }
        onClick={processFastPayPayment}
        sx={{ 
          py: 3, 
          fontSize: '1.2rem',
          fontWeight: 'bold',
          bgcolor: 'primary.main',
          '&:hover': {
            bgcolor: 'primary.dark'
          }
        }}
        startIcon={fastPayProcessing ? <CircularProgress size={20} /> : <QrCodeScanner />}
      >
        {fastPayProcessing 
          ? '🔄 Processing FastPay...' 
          : `🏦 Process FastPay $${exactRemainingAmount.toFixed(2)}`
        }
      </Button>
      
      <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block', textAlign: 'center' }}>
        Powered by Uzum Bank • Secure payment processing
      </Typography>
    </Box>
  );
};
