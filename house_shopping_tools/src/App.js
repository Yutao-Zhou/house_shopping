import React, { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [loanAmount, setLoanAmount] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [loanTerm, setLoanTerm] = useState("");
  const [monthlyPayment, setMonthlyPayment] = useState(null);
  const [paymentBreakdown, setPaymentBreakdown] = useState([]);
  const [error, setError] = useState("");

  // Load saved values from localStorage on component mount
  useEffect(() => {
    const savedLoanAmount = localStorage.getItem("loanAmount");
    const savedInterestRate = localStorage.getItem("interestRate");
    const savedLoanTerm = localStorage.getItem("loanTerm");

    if (savedLoanAmount) setLoanAmount(savedLoanAmount);
    if (savedInterestRate) setInterestRate(savedInterestRate);
    if (savedLoanTerm) setLoanTerm(savedLoanTerm);
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === "loanAmount") setLoanAmount(value);
    if (name === "interestRate") setInterestRate(value);
    if (name === "loanTerm") setLoanTerm(value);

    // Save values to localStorage
    localStorage.setItem(name, value);
  };

  const calculatePayment = (e) => {
    e.preventDefault();

    const loan = parseFloat(loanAmount);
    const rate = parseFloat(interestRate);
    const term = parseFloat(loanTerm);

    if (loan <= 0 || rate <= 0 || term <= 0) {
      setError("All values must be greater than zero.");
      return;
    }

    setError("");

    const interestRatePerMonth = rate / 100 / 12;
    const totalPayments = term * 12;

    const numerator = interestRatePerMonth * Math.pow(1 + interestRatePerMonth, totalPayments);
    const denominator = Math.pow(1 + interestRatePerMonth, totalPayments) - 1;
    const monthly = loan * (numerator / denominator);

    setMonthlyPayment(monthly.toFixed(2));

    // Generate monthly breakdown of principal and interest
    let breakdown = [];
    let remainingBalance = loan;

    for (let i = 1; i <= totalPayments; i++) {
      const interestPayment = remainingBalance * interestRatePerMonth;
      const principalPayment = monthly - interestPayment;
      remainingBalance -= principalPayment;

      // Convert month number to years and months
      const years = Math.floor(i / 12);
      const months = i % 12;
      const formattedMonth = years > 0 ? `${years} year${years > 1 ? 's' : ''} ${months} month${months > 1 ? 's' : ''}` : `${months} month${months > 1 ? 's' : ''}`;

      breakdown.push({
        month: formattedMonth,
        principalPayment: principalPayment.toFixed(2),
        interestPayment: interestPayment.toFixed(2),
        remainingBalance: remainingBalance.toFixed(2),
        isPrincipalHigher: principalPayment > interestPayment,
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
            name="loanAmount"
            min="0"
            value={loanAmount}
            onChange={handleInputChange}
            required
          />
        </div>
        <div>
          <label>Annual Interest Rate (%): </label>
          <input
            type="number"
            name="interestRate"
            step="0.01"
            min="0"
            value={interestRate}
            onChange={handleInputChange}
            required
          />
        </div>
        <div>
          <label>Loan Term (years): </label>
          <input
            type="number"
            name="loanTerm"
            min="0"
            value={loanTerm}
            onChange={handleInputChange}
            required
          />
        </div>
        <button type="submit">Calculate</button>
      </form>

      {error && <div className="error">{error}</div>}

      {monthlyPayment && (
        <div>
          <h2>Monthly Payment: ${monthlyPayment}</h2>

          {/* Payment Breakdown Table */}
          <h3>Payment Breakdown</h3>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Principal Payment ($)</th>
                <th>Interest Payment ($)</th>
                <th>Remaining Balance ($)</th>
              </tr>
            </thead>
            <tbody>
              {paymentBreakdown.map((payment, index) => (
                <tr key={index} className={payment.isPrincipalHigher ? 'highlight-principal' : ''}>
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
