import {
  Print,
  Receipt as ReceiptIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Typography,
} from '@mui/material';
import { useEffect } from 'react';
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
    name_uz?: string; // Uzbek product name
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

  // Fixed Uzbek labels for receipt - always in Uzbek regardless of current language
  const uzbekLabels = {
    receipt: "KVITANSIYA",
    companyName: "ROCKPOINT POS",
    transactionId: "TXN",
    terminal: "TERMINAL",
    cashier: "KASSIR",
    subtotal: "ORALIQ JAMI:",
    tax: "SOLIQ:",
    total: "JAMI:",
    payment: "TO'LOV:",
    changeDue: "QAYTIM:",
    thankYou: "XARIDINGIZ UCHUN RAHMAT",
    keepReceipt: "Ushbu kvitansiyani saqlang",
    forYourRecords: "hisob qaydlaringiz uchun",
    cash: "NAQD",
    card: "KARTA",
    digital: "RAQAMLI"
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'cash': return uzbekLabels.cash;
      case 'card': return uzbekLabels.card;
      case 'digital_wallet': return uzbekLabels.digital;
      default: return method.toUpperCase();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Auto-print receipt when dialog opens
  useEffect(() => {
    if (open) {
      // Small delay to ensure the dialog is fully rendered before printing
      const timer = setTimeout(() => {
        handlePrint();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [open]);

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
            maxWidth: '80mm',
            width: '80mm',
            backgroundColor: 'white',
          }
        }
      }}
    >
      <DialogContent sx={{
        p: 4,
        backgroundColor: 'white',
        color: 'black',
        '@media print': {
          p: 1,
          fontSize: '12px',
          lineHeight: 1.2,
          fontFamily: 'monospace',
        }
      }}>
        {/* Receipt Header */}
        <Box sx={{
          textAlign: 'center',
          mb: 3,
          '@media print': { mb: 1 }
        }}>
          <Typography variant="h5" sx={{
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: 'black',
            '@media print': {
              fontSize: '14px',
              fontWeight: 'bold',
              marginBottom: '4px'
            }
          }}>
            {uzbekLabels.companyName}
          </Typography>
          <Typography variant="body2" sx={{
            fontFamily: 'monospace',
            color: 'black',
            '@media print': {
              fontSize: '10px',
              marginBottom: '2px'
            }
          }}>
            {uzbekLabels.receipt}
          </Typography>
          <Typography variant="body2" sx={{
            fontFamily: 'monospace',
            color: 'black',
            '@media print': {
              fontSize: '10px',
              marginBottom: '2px'
            }
          }}>
            {currentTime.toLocaleDateString()} {currentTime.toLocaleTimeString()}
          </Typography>
          <Typography variant="body2" sx={{
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: 'black',
            '@media print': {
              fontSize: '10px',
              marginBottom: '2px'
            }
          }}>
            {uzbekLabels.transactionId}: {transactionId}
          </Typography>
          {terminalId && (
            <Typography variant="body2" sx={{
              fontFamily: 'monospace',
              color: 'black',
              '@media print': {
                fontSize: '10px',
                marginBottom: '1px'
              }
            }}>
              {uzbekLabels.terminal}: {terminalId}
            </Typography>
          )}
          {employeeName && (
            <Typography variant="body2" sx={{
              fontFamily: 'monospace',
              color: 'black',
              '@media print': {
                fontSize: '10px',
                marginBottom: '2px'
              }
            }}>
              {uzbekLabels.cashier}: {employeeName}
            </Typography>
          )}
        </Box>

        <Box sx={{
          borderTop: '1px solid black',
          borderBottom: '1px solid black',
          my: 2,
          '@media print': {
            borderTop: '1px solid black',
            borderBottom: '1px solid black',
            my: '4px'
          }
        }} />

        {/* Items */}
        <Box sx={{
          mb: 3,
          '@media print': { mb: 1 }
        }}>
          {cartItems.map((item, index) => (
            <Box key={index} sx={{
              mb: 1,
              '@media print': { mb: '2px' }
            }}>
              <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start'
              }}>
                <Box sx={{ flex: 1, pr: 1 }}>
                  <Typography variant="body2" sx={{
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    color: 'black',
                    '@media print': {
                      fontSize: '10px',
                      lineHeight: 1.1
                    }
                  }}>
                    {(item.product.name_uz || item.product.name).toUpperCase()}
                  </Typography>
                  <Typography variant="caption" sx={{
                    fontFamily: 'monospace',
                    color: 'black',
                    '@media print': {
                      fontSize: '9px'
                    }
                  }}>
                    {item.quantity} x ${item.unit_price.toFixed(2)}
                    {item.product.barcode && ` [${item.product.barcode}]`}
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  color: 'black',
                  textAlign: 'right',
                  '@media print': {
                    fontSize: '10px'
                  }
                }}>
                  ${item.total_price.toFixed(2)}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>

        <Box sx={{
          borderTop: '1px solid black',
          borderBottom: '1px solid black',
          my: 2,
          '@media print': {
            borderTop: '1px solid black',
            borderBottom: '1px solid black',
            my: '4px'
          }
        }} />

        {/* Totals */}
        <Box sx={{
          mb: 3,
          '@media print': { mb: 1 }
        }}>
          <Box display="flex" justifyContent="space-between" sx={{ mb: 0.5 }}>
            <Typography variant="body2" sx={{
              fontFamily: 'monospace',
              color: 'black',
              '@media print': {
                fontSize: '10px'
              }
            }}>
              {uzbekLabels.subtotal}
            </Typography>
            <Typography variant="body2" sx={{
              fontFamily: 'monospace',
              color: 'black',
              '@media print': {
                fontSize: '10px'
              }
            }}>
              ${subtotal.toFixed(2)}
            </Typography>
          </Box>
          <Box display="flex" justifyContent="space-between" sx={{ mb: 0.5 }}>
            <Typography variant="body2" sx={{
              fontFamily: 'monospace',
              color: 'black',
              '@media print': {
                fontSize: '10px'
              }
            }}>
              {uzbekLabels.tax}
            </Typography>
            <Typography variant="body2" sx={{
              fontFamily: 'monospace',
              color: 'black',
              '@media print': {
                fontSize: '10px'
              }
            }}>
              ${taxAmount.toFixed(2)}
            </Typography>
          </Box>
          <Box sx={{
            borderTop: '1px dashed black',
            pt: 0.5,
            mt: 0.5,
            '@media print': {
              borderTop: '1px dashed black',
              pt: '2px',
              mt: '2px'
            }
          }}>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="body1" sx={{
                fontFamily: 'monospace',
                fontWeight: 'bold',
                color: 'black',
                '@media print': {
                  fontSize: '12px',
                  fontWeight: 'bold'
                }
              }}>
                {uzbekLabels.total}
              </Typography>
              <Typography variant="body1" sx={{
                fontFamily: 'monospace',
                fontWeight: 'bold',
                color: 'black',
                '@media print': {
                  fontSize: '12px',
                  fontWeight: 'bold'
                }
              }}>
                ${totalAmount.toFixed(2)}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box sx={{
          borderTop: '1px solid black',
          borderBottom: '1px solid black',
          my: 2,
          '@media print': {
            borderTop: '1px solid black',
            borderBottom: '1px solid black',
            my: '4px'
          }
        }} />

        {/* Payments */}
        <Box sx={{
          mb: 3,
          '@media print': { mb: 1 }
        }}>
          <Typography variant="body2" sx={{
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: 'black',
            mb: 1,
            '@media print': {
              fontSize: '10px',
              marginBottom: '2px'
            }
          }}>
            {uzbekLabels.payment}
          </Typography>
          {payments.map((payment) => (
            <Box key={payment.id} sx={{
              mb: 1,
              '@media print': { mb: '1px' }
            }}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" sx={{
                  fontFamily: 'monospace',
                  color: 'black',
                  '@media print': {
                    fontSize: '10px'
                  }
                }}>
                  {getPaymentMethodLabel(payment.method)}
                </Typography>
                <Typography variant="body2" sx={{
                  fontFamily: 'monospace',
                  color: 'black',
                  '@media print': {
                    fontSize: '10px'
                  }
                }}>
                  ${payment.amount.toFixed(2)}
                </Typography>
              </Box>
            </Box>
          ))}

          {changeAmount > 0 && (
            <Box sx={{
              mt: 1,
              pt: 0.5,
              borderTop: '1px dashed black',
              '@media print': {
                mt: '2px',
                pt: '2px',
                borderTop: '1px dashed black'
              }
            }}>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" sx={{
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  color: 'black',
                  '@media print': {
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }
                }}>
                  {uzbekLabels.changeDue}
                </Typography>
                <Typography variant="body2" sx={{
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  color: 'black',
                  '@media print': {
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }
                }}>
                  ${changeAmount.toFixed(2)}
                </Typography>
              </Box>
            </Box>
          )}
        </Box>

        <Box sx={{
          borderTop: '1px solid black',
          borderBottom: '1px solid black',
          my: 2,
          '@media print': {
            borderTop: '1px solid black',
            borderBottom: '1px solid black',
            my: '4px'
          }
        }} />

        <Box sx={{
          textAlign: 'center',
          '@media print': { mt: '6px' }
        }}>
          <Typography variant="body2" sx={{
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: 'black',
            '@media print': {
              fontSize: '10px',
              marginBottom: '2px'
            }
          }}>
            {uzbekLabels.thankYou}
          </Typography>
          <Typography variant="caption" sx={{
            fontFamily: 'monospace',
            color: 'black',
            '@media print': {
              fontSize: '9px',
              marginBottom: '1px'
            }
          }}>
            {uzbekLabels.keepReceipt}
          </Typography>
          <Typography variant="caption" sx={{
            fontFamily: 'monospace',
            color: 'black',
            display: 'block',
            '@media print': {
              fontSize: '9px'
            }
          }}>
            {uzbekLabels.forYourRecords}
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
          Print Receipt
        </Button>
        <Button
          onClick={onClose}
          variant="contained"
          startIcon={<ReceiptIcon />}
          size="large"
          sx={{ py: 1.5, px: 3, fontSize: '1.1rem' }}
        >
          {t('checkout.newTransaction')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
