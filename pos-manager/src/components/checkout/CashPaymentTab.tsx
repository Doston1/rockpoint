import { Box, Button, Typography } from '@mui/material';

interface CashPaymentTabProps {
  cashSum: number;
  setCashSum: (value: number | ((prev: number) => number)) => void;
  exactRemainingAmount: number;
  remainingAmount: number;
  onProcessPayment: (method: 'cash', amount: number) => void;
}

const CASH_DENOMINATIONS = [
  { value: 0.1, label: '$0.10', color: '#8E24AA' },
  { value: 0.5, label: '$0.50', color: '#5E35B1' },
  { value: 1, label: '$1.00', color: '#3949AB' },
  { value: 5, label: '$5.00', color: '#1E88E5' },
  { value: 10, label: '$10.00', color: '#00ACC1' },
  { value: 50, label: '$50.00', color: '#00897B' },
  { value: 100, label: '$100.00', color: '#43A047' },
];

export const CashPaymentTab: React.FC<CashPaymentTabProps> = ({
  cashSum,
  setCashSum,
  exactRemainingAmount,
  remainingAmount,
  onProcessPayment,
}) => {
  const resetCashSum = () => setCashSum(0);

  const addCashDenomination = (value: number) => {
    setCashSum(prev => Math.round((prev + value) * 100) / 100);
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom color="primary" fontWeight="bold">
        💵 Cash Payment
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={3}>
        Click the bill/coin amounts received from customer
      </Typography>
      
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" color="text.secondary" mb={1}>
          Current Amount:
        </Typography>
        <Typography variant="h2" color="primary" fontWeight="bold" sx={{ mb: 3 }}>
          ${cashSum.toFixed(2)}
        </Typography>
        
        <Typography variant="h6" color="text.secondary" mb={2}>
          Select Bills & Coins:
        </Typography>
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
          gap: 2,
          mb: 3
        }}>
          {CASH_DENOMINATIONS.map((denom) => (
            <Button
              key={denom.value}
              fullWidth
              variant="outlined"
              size="large"
              onClick={() => addCashDenomination(denom.value)}
              sx={{ 
                py: 3, 
                fontSize: '1.2rem',
                fontWeight: 'bold',
                minHeight: 80,
                borderWidth: 2,
                bgcolor: denom.color + '10',
                borderColor: denom.color,
                color: denom.color,
                '&:hover': {
                  bgcolor: denom.color + '20',
                  borderColor: denom.color,
                  transform: 'scale(1.05)'
                },
                transition: 'all 0.2s'
              }}
            >
              {denom.label}
            </Button>
          ))}
        </Box>
        
        <Box sx={{ display: 'flex', gap: 3 }}>
          <Button
            fullWidth
            variant="outlined"
            color="error"
            size="large"
            onClick={resetCashSum}
            disabled={cashSum === 0}
            sx={{ py: 2, fontSize: '1.1rem' }}
          >
            🔄 Reset Amount
          </Button>
          <Button
            fullWidth
            variant="outlined"
            color="primary"
            size="large"
            onClick={() => setCashSum(exactRemainingAmount)}
            disabled={remainingAmount <= 0}
            sx={{ py: 2, fontSize: '1.1rem' }}
          >
            📊 Pay Remaining (${remainingAmount.toFixed(1)})
          </Button>
          <Button
            fullWidth
            variant="contained"
            size="large"
            disabled={cashSum <= 0}
            onClick={() => onProcessPayment('cash', cashSum)}
            sx={{ 
              py: 2, 
              fontSize: '1.2rem',
              fontWeight: 'bold'
            }}
          >
            💰 Pay ${cashSum.toFixed(2)}
            {cashSum > remainingAmount && (
              <Typography component="span" sx={{ fontSize: '0.9rem', display: 'block' }}>
                (Change: ${(cashSum - remainingAmount).toFixed(2)})
              </Typography>
            )}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};
