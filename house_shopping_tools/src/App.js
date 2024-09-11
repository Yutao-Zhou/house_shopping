import React, { useState } from "react";
import "./App.css";

function App() {
  const [loanAmount, setLoanAmount] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [loanTerm, setLoanTerm] = useState("");
  const [monthlyPayment, setMonthlyPayment] = useState(null);
  const [paymentBreakdown, setPaymentBreakdown] = useState([]);

  const calculatePayment = (e) => {
    e.preventDefault();

    const interestRatePerMonth = parseFloat(interestRate) / 100 / 12;
    const totalPayments = parseFloat(loanTerm) * 12;
    const principal = parseFloat(loanAmount);

    const numerator = interestRatePerMonth * Math.pow(1 + interestRatePerMonth, totalPayments);
    const denominator = Math.pow(1 + interestRatePerMonth, totalPayments) - 1;
    const monthly = principal * (numerator / denominator);

    setMonthlyPayment(monthly.toFixed(2));

    // Generate monthly breakdown of principal and interest
    let breakdown = [];
    let remainingBalance = principal;

    for (let i = 1; i <= totalPayments; i++) {
      const interestPayment = remainingBalance * interestRatePerMonth;
      const principalPayment = monthly - interestPayment;
      remainingBalance -= principalPayment;

      breakdown.push({
        month: i,
        principalPayment: principalPayment.toFixed(2),
        interestPayment: interestPayment.toFixed(2),
        remainingBalance: remainingBalance.toFixed(2),
      });
    }

    setPaymentBreakdown(breakdown);
  };

  return (
    <div className="App">
      <h1>Mortgage Calculator</h1>
      <form onSubmit={calculatePayment}>
        <div>
          <label>Loan Amount ($): </label>
          <input
            type="number"
            value={loanAmount}
            onChange={(e) => setLoanAmount(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Annual Interest Rate (%): </label>
          <input
            type="number"
            step="0.01"
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Loan Term (years): </label>
          <input
            type="number"
            value={loanTerm}
            onChange={(e) => setLoanTerm(e.target.value)}
            required
          />
        </div>
        <button type="submit">Calculate</button>
      </form>

      {monthlyPayment && (
        <div>
          <h2>Monthly Payment: ${monthlyPayment}</h2>

          {/* Payment Breakdown Table */}
          <h3>Payment Breakdown</h3>
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Principal Payment ($)</th>
                <th>Interest Payment ($)</th>
                <th>Remaining Balance ($)</th>
              </tr>
            </thead>
            <tbody>
              {paymentBreakdown.map((payment) => (
                <tr key={payment.month}>
                  <td>{payment.month}</td>
                  <td>{payment.principalPayment}</td>
                  <td>{payment.interestPayment}</td>
                  <td>{payment.remainingBalance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default App;
