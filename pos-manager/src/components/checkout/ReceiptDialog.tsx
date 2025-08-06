import {
  CheckCircle,
  Print,
  Receipt as ReceiptIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

interface Payment {
  id: string;
  method: 'cash' | 'card' | 'digital_wallet';
  amount: number;
  timestamp: Date;
}

interface CartItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product: {
    name: string;
    barcode?: string;
  };
}

interface ReceiptDialogProps {
  open: boolean;
  onClose: () => void;
  transactionId: string;
  cartItems: CartItem[];
  payments: Payment[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  changeAmount: number;
  employeeName?: string;
  terminalId?: string;
}

export const ReceiptDialog: React.FC<ReceiptDialogProps> = ({
  open,
  onClose,
  transactionId,
  cartItems,
  payments,
  subtotal,
  taxAmount,
  totalAmount,
  changeAmount,
  employeeName,
  terminalId,
}) => {
  const { t } = useTranslation();
  const currentTime = new Date();

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'cash': return t('checkout.cash');
      case 'card': return t('checkout.card');
      case 'digital_wallet': return t('checkout.digitalWallet');
      default: return method;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          '@media print': {
            boxShadow: 'none',
            margin: 0,
            padding: 0,
          }
        }
      }}
    >
      <DialogContent sx={{ p: 4, '@media print': { p: 2 } }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <CheckCircle sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
          <Typography variant="h4" color="success.main" fontWeight="bold" gutterBottom>
            {t('checkout.transactionComplete')}
          </Typography>
        </Box>

        {/* Receipt Header */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h4" fontWeight="bold" color="primary" gutterBottom>
            🏪 RockPoint POS
          </Typography>
          <Typography variant="h6" color="success.main" fontWeight="bold" gutterBottom>
            ✅ TRANSACTION COMPLETE
          </Typography>
          <Typography variant="body1" color="text.secondary">
            📅 {currentTime.toLocaleDateString()} • 🕐 {currentTime.toLocaleTimeString()}
          </Typography>
          <Typography variant="body1" color="text.secondary" fontWeight="medium">
            Transaction ID: #{transactionId}
          </Typography>
          {terminalId && (
            <Typography variant="body2" color="text.secondary">
              🖥️ Terminal: {terminalId}
            </Typography>
          )}
          {employeeName && (
            <Typography variant="body2" color="text.secondary">
              👤 Cashier: {employeeName}
            </Typography>
          )}
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Items */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom color="primary">
            🛒 Items Purchased
          </Typography>
          {cartItems.map((item, index) => (
            <Box key={index} sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="start">
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body1" fontWeight="bold">
                    {item.product.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Quantity: {item.quantity} × ${item.unit_price.toFixed(2)} each
                    {item.product.barcode && ` • Barcode: ${item.product.barcode}`}
                  </Typography>
                </Box>
                <Typography variant="h6" fontWeight="bold" color="primary">
                  ${item.total_price.toFixed(2)}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Totals */}
        <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.100', borderRadius: 2 }}>
          <Box display="flex" justifyContent="space-between" mb={1}>
            <Typography variant="body1" fontWeight="medium">💰 {t('checkout.subtotal')}:</Typography>
            <Typography variant="body1" fontWeight="medium">${subtotal.toFixed(2)}</Typography>
          </Box>
          <Box display="flex" justifyContent="space-between" mb={1}>
            <Typography variant="body1" fontWeight="medium">🧾 {t('checkout.tax')}:</Typography>
            <Typography variant="body1" fontWeight="medium">${taxAmount.toFixed(2)}</Typography>
          </Box>
          <Divider sx={{ my: 1 }} />
          <Box display="flex" justifyContent="space-between" mb={2}>
            <Typography variant="h6" fontWeight="bold" color="primary">💳 {t('checkout.total')}:</Typography>
            <Typography variant="h6" fontWeight="bold" color="primary">${totalAmount.toFixed(2)}</Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Payments */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom color="primary">
            💵 Payment Methods Used
          </Typography>
          {payments.map((payment, index) => (
            <Box key={payment.id} sx={{ mb: 2, p: 2, bgcolor: 'success.light', borderRadius: 2, border: 1, borderColor: 'success.main' }}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="body1" fontWeight="bold">
                    Payment #{index + 1} - {getPaymentMethodLabel(payment.method)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    🕐 {payment.timestamp.toLocaleTimeString()}
                  </Typography>
                </Box>
                <Typography variant="h6" fontWeight="bold" color="success.dark">
                  ${payment.amount.toFixed(2)}
                </Typography>
              </Box>
            </Box>
          ))}
          
          {changeAmount > 0 && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'warning.light', borderRadius: 2, border: 2, borderColor: 'warning.main' }}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h6" fontWeight="bold" color="warning.dark">
                  💰 {t('checkout.changeDue')}:
                </Typography>
                <Typography variant="h5" fontWeight="bold" color="warning.dark">
                  ${changeAmount.toFixed(2)}
                </Typography>
              </Box>
            </Box>
          )}
        </Box>

        <Divider sx={{ mb: 3 }} />

        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Typography variant="h6" color="success.main" fontWeight="bold" gutterBottom>
            🙏 {t('checkout.thankYou')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            📄 Please keep this receipt for your records
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            🏪 Thank you for shopping with RockPoint POS!
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, '@media print': { display: 'none' } }}>
        <Button
          onClick={handlePrint}
          variant="outlined"
          startIcon={<Print />}
          size="large"
          sx={{ mr: 'auto', py: 1.5, px: 3 }}
        >
          🖨️ Print Receipt
        </Button>
        <Button 
          onClick={onClose}
          variant="contained"
          startIcon={<ReceiptIcon />}
          size="large"
          sx={{ py: 1.5, px: 3, fontSize: '1.1rem' }}
        >
          ✅ {t('checkout.newTransaction')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
