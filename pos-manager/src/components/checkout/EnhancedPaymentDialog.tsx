import {
  Money,
  Payment as PaymentIcon,
  QrCode,
  Receipt,
  Remove,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { apiService, type PaymentMethodStatus } from '../../services/api';
import { CashPaymentTab } from './CashPaymentTab';
import { ClickPassTab } from './ClickPassTab';
import { PaymeTab } from './PaymeTab';
import { UzumFastPayTab } from './UzumFastPayTab';

interface Payment {
  id: string;
  method: 'cash' | 'card' | 'digital_wallet' | 'fastpay' | 'click_pass' | 'payme_qr' | 'payme';
  amount: number;
  timestamp: Date;
}

interface EnhancedPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  totalAmount: number;
  onPaymentComplete: (payments: Payment[], receiptData: any) => void;
  isProcessing: boolean;
  cartItems?: any[];
  taxAmount?: number;
  subtotal?: number;
  employeeName?: string;
  terminalId?: string;
}

export const EnhancedPaymentDialog: React.FC<EnhancedPaymentDialogProps> = ({
  open,
  onClose,
  totalAmount,
  onPaymentComplete,
  isProcessing,
  cartItems = [],
  employeeName,
  terminalId,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [cashSum, setCashSum] = useState(0);
  const [activePaymentMethods, setActivePaymentMethods] = useState<PaymentMethodStatus[]>([]);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(true);
  
  const paidAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const remainingAmount = Math.max(0, totalAmount - paidAmount);
  const exactRemainingAmount = Math.round(remainingAmount * 100) / 100;

  // Load active payment methods
  useEffect(() => {
    const loadPaymentMethods = async () => {
      try {
        setLoadingPaymentMethods(true);
        const response = await apiService.getActivePaymentMethods();
        if (response.data?.payment_methods) {
          setActivePaymentMethods(response.data.payment_methods);
        }
      } catch (error) {
        console.error('Failed to load payment methods:', error);
        // Fallback: Enable common payment methods if API fails
        setActivePaymentMethods([
          { payment_method_code: 'uzum_fastpay', payment_method_name: 'Uzum FastPay', is_enabled: true, priority: 1, credentials_configured: true, sync_status: 'synced', created_at: '', updated_at: '' },
          { payment_method_code: 'click_pass', payment_method_name: 'Click Pass', is_enabled: true, priority: 2, credentials_configured: true, sync_status: 'synced', created_at: '', updated_at: '' },
          { payment_method_code: 'payme', payment_method_name: 'PayMe', is_enabled: true, priority: 3, credentials_configured: true, sync_status: 'synced', created_at: '', updated_at: '' }
        ]);
      } finally {
        setLoadingPaymentMethods(false);
      }
    };

    if (open) {
      loadPaymentMethods();
    }
  }, [open]);

  // Reset state when dialog opens/closes
  const resetDialog = () => {
    setPayments([]);
    setCashSum(0);
    setActiveTab(0);
  };

  useEffect(() => {
    if (open) {
      resetDialog();
    }
  }, [open]);

  const handleClose = () => {
    resetDialog();
    onClose();
  };

  const processPayment = (method: string, amount: number) => {
    const newPayment: Payment = {
      id: Date.now().toString(),
      method: method as Payment['method'],
      amount,
      timestamp: new Date()
    };

    const updatedPayments = [...payments, newPayment];
    setPayments(updatedPayments);

    // Check if payment is complete
    const newPaidAmount = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
    if (newPaidAmount >= totalAmount) {
      const receiptData = {
        payments: updatedPayments,
        total: totalAmount,
        paid: newPaidAmount,
        change: newPaidAmount - totalAmount,
        items: cartItems,
        employee: employeeName,
        terminal: terminalId,
        timestamp: new Date()
      };
      
      onPaymentComplete(updatedPayments, receiptData);
    }
  };

  const removePayment = (paymentId: string) => {
    setPayments(prev => prev.filter(p => p.id !== paymentId));
  };

  // Get available payment methods
  const getAvailablePaymentMethods = () => {
    const methods = ['cash'];
    
    
    if (isPaymentMethodActive('uzum_fastpay')) {
      methods.push('uzum_fastpay');
    } 
    
    // Check for click payment method (backend uses 'click', frontend uses 'click_pass')
    if (isPaymentMethodActive('click')) {
      methods.push('click_pass');
    } 
    
    if (isPaymentMethodActive('payme')) {
      methods.push('payme');
    } 
    
    return methods;
  };

  const isPaymentMethodActive = (method: string): boolean => {
    const isActive = activePaymentMethods.some(pm => pm.payment_method_code === method && pm.is_enabled);
    return isActive;
  };

  const getCurrentTabType = (tabIndex: number): string => {
    const tabs = getAvailablePaymentMethods();
    return tabs[tabIndex] || 'cash';
  };

  const getTabIcon = (method: string) => {
    switch (method) {
      case 'cash': return <Money />;
      case 'uzum_fastpay': return <QrCode />;
      case 'click_pass': return <QrCode />;
      case 'payme': return <QrCode />;
      default: return <PaymentIcon />;
    }
  };

  const getTabLabel = (method: string) => {
    switch (method) {
      case 'cash': return '💵 Cash Payment';
      case 'uzum_fastpay': return '🏦 Uzum FastPay';
      case 'click_pass': return '💸 Click Pass';
      case 'payme': return '💳 PayMe';
      default: return method;
    }
  };

  if (loadingPaymentMethods) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
            <CircularProgress sx={{ mr: 2 }} />
            <Typography>Loading payment methods...</Typography>
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 3, overflow: 'hidden' }
      }}
    >
      <DialogTitle sx={{ 
        bgcolor: 'primary.main', 
        color: 'white', 
        display: 'flex', 
        alignItems: 'center',
        justifyContent: 'space-between',
        pb: 2
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <PaymentIcon sx={{ mr: 2, fontSize: 28 }} />
          <Typography variant="h5" component="div" sx={{ fontWeight: 'bold' }}>
            💳 Enhanced Payment Terminal
          </Typography>
        </Box>
        <IconButton 
          onClick={handleClose} 
          sx={{ color: 'white' }}
          disabled={isProcessing}
        >
          <Remove />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {/* Payment Summary Section */}
        <Box sx={{ p: 3, bgcolor: 'grey.50', borderBottom: 1, borderColor: 'grey.200' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" color="text.secondary">
              💰 Payment Summary
            </Typography>
            {isProcessing && (
              <CircularProgress size={20} />
            )}
          </Box>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3, mb: 2 }}>
            <Card sx={{ p: 2, textAlign: 'center', bgcolor: 'info.light' }}>
              <Typography variant="body2" color="text.secondary">Total Amount</Typography>
              <Typography variant="h5" fontWeight="bold" color="info.main">
                ${totalAmount.toFixed(2)}
              </Typography>
            </Card>
            <Card sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light' }}>
              <Typography variant="body2" color="text.secondary">Paid Amount</Typography>
              <Typography variant="h5" fontWeight="bold" color="success.main">
                ${paidAmount.toFixed(2)}
              </Typography>
            </Card>
            <Card sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.light' }}>
              <Typography variant="body2" color="text.secondary">Remaining</Typography>
              <Typography variant="h5" fontWeight="bold" color="warning.main">
                ${remainingAmount.toFixed(2)}
              </Typography>
            </Card>
          </Box>
          
          {remainingAmount <= 0 && (
            <Alert severity="success" sx={{ mb: 2 }}>
              🎉 Payment Complete! 
              {paidAmount > totalAmount && (
                <span> Change: ${(paidAmount - totalAmount).toFixed(2)}</span>
              )}
            </Alert>
          )}
          
          {/* Progress Bar */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Payment Progress: {Math.min(100, (paidAmount / totalAmount) * 100).toFixed(1)}%
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={Math.min(100, (paidAmount / totalAmount) * 100)}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>
        </Box>

        {/* Payment History */}
        {payments.length > 0 && (
          <Box sx={{ p: 3, borderBottom: 1, borderColor: 'grey.200' }}>
            <Typography variant="h6" gutterBottom color="text.secondary">
              📋 Payment History
            </Typography>
            {payments.map((payment) => (
              <Card key={payment.id} sx={{ mb: 1, p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {getTabIcon(payment.method)}
                    <Box sx={{ ml: 2 }}>
                      <Typography variant="body1" fontWeight="bold">
                        {getTabLabel(payment.method)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {payment.timestamp.toLocaleTimeString()}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="h6" sx={{ mr: 2 }}>
                      ${payment.amount.toFixed(2)}
                    </Typography>
                    <IconButton 
                      onClick={() => removePayment(payment.id)}
                      color="error"
                      size="small"
                    >
                      <Remove />
                    </IconButton>
                  </Box>
                </Box>
              </Card>
            ))}
          </Box>
        )}

        {/* Payment Method Tabs */}
        {remainingAmount > 0 && (
          <Box>
            <Tabs 
              value={activeTab} 
              onChange={(_, newValue) => setActiveTab(newValue)}
              variant="fullWidth"
              sx={{ borderBottom: 1, borderColor: 'grey.200' }}
            >
              {getAvailablePaymentMethods().map((method) => (
                <Tab 
                  key={method}
                  icon={getTabIcon(method)} 
                  label={getTabLabel(method)}
                  iconPosition="top"
                />
              ))}
            </Tabs>

            <Box sx={{ p: 3 }}>
              {/* Cash Payment Tab */}
              {getCurrentTabType(activeTab) === 'cash' && (
                <CashPaymentTab
                  cashSum={cashSum}
                  setCashSum={setCashSum}
                  exactRemainingAmount={exactRemainingAmount}
                  remainingAmount={remainingAmount}
                  onProcessPayment={processPayment}
                />
              )}

              {/* Uzum FastPay Payment Tab */}
              {getCurrentTabType(activeTab) === 'uzum_fastpay' && (
                <UzumFastPayTab
                  exactRemainingAmount={exactRemainingAmount}
                  remainingAmount={remainingAmount}
                  onProcessPayment={processPayment}
                  cartItems={cartItems}
                  terminalId={terminalId}
                />
              )}

              {/* Click Pass Payment Tab */}
              {getCurrentTabType(activeTab) === 'click_pass' && (
                <ClickPassTab
                  exactRemainingAmount={exactRemainingAmount}
                  onProcessPayment={processPayment}
                  terminalId={terminalId}
                />
              )}

              {/* PayMe Payment Tab */}
              {getCurrentTabType(activeTab) === 'payme' && (
                <PaymeTab
                  exactRemainingAmount={exactRemainingAmount}
                  onProcessPayment={processPayment}
                  terminalId={terminalId}
                />
              )}
            </Box>
          </Box>
        )}

        {/* Complete Payment Section */}
        {remainingAmount <= 0 && (
          <Box sx={{ p: 3, textAlign: 'center', bgcolor: 'success.light' }}>
            <Receipt sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
            <Typography variant="h5" color="success.main" gutterBottom fontWeight="bold">
              🎉 Payment Completed Successfully!
            </Typography>
            <Typography variant="body1" color="text.secondary" mb={3}>
              Transaction processed. You can now print the receipt.
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={handleClose}
              sx={{ px: 4, py: 2, fontSize: '1.1rem' }}
            >
              📄 Complete & Print Receipt
            </Button>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};
