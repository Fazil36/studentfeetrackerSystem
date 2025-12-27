document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('fee-form');
    const recordsBody = document.getElementById('fee-records-body');
    const rollNumberInput = document.getElementById('roll-number');
    const filterNameInput = document.getElementById('filter-name');
    const filterStatusSelect = document.getElementById('filter-status');

    // --- Core Functions ---

    // 1. Load data from Local Storage
    const getFeeRecords = () => {
        const records = localStorage.getItem('feeRecords');
        return records ? JSON.parse(records) : [];
    };

    // 2. Save data to Local Storage
    const saveFeeRecords = (records) => {
        localStorage.setItem('feeRecords', JSON.stringify(records));
    };

    // 3. Dynamic DOM Manipulation to Render Table
    const renderRecords = (recordsToRender) => {
        // Clear existing rows (DOM Manipulation)
        recordsBody.innerHTML = ''; 

        if (recordsToRender.length === 0) {
            recordsBody.innerHTML = '<tr><td colspan="9" style="text-align: center;">No records found.</td></tr>';
            return;
        }

        const formatCurrency = (val) => {
            if (typeof val !== 'number' || isNaN(val)) return '-';
            return `₹ ${val.toFixed(2)}`;
        };

        recordsToRender.forEach((record, index) => {
            const row = recordsBody.insertRow();
            // Columns: ID, RollNo, Name, AmountPaid, TotalFee, Date, Status, Balance, History
            row.insertCell(0).textContent = index + 1;
            row.insertCell(1).textContent = record.rollNumber ? record.rollNumber : '-';
            row.insertCell(2).textContent = record.name;

            // Determine paid amount: prefer payments array, else legacy amount
            let paidAmount = 0;
            if (Array.isArray(record.payments) && record.payments.length > 0) {
                paidAmount = record.payments.reduce((s, p) => s + (typeof p.amount === 'number' ? p.amount : parseFloat(p.amount) || 0), 0);
            } else if (typeof record.amount === 'number') {
                paidAmount = record.amount;
            } else if (record.amount) {
                const parsed = parseFloat(record.amount);
                paidAmount = !isNaN(parsed) ? parsed : 0;
            }

            row.insertCell(3).textContent = formatCurrency(paidAmount);
            row.insertCell(4).textContent = record.totalFee ? formatCurrency(record.totalFee) : '-';
            row.insertCell(5).textContent = record.date || '-';

            const statusCell = row.insertCell(6);
            statusCell.textContent = record.status || '-';
            if (record.status) statusCell.classList.add(`status-${record.status}`);

            // Compute balance
            let balance;
            if (typeof record.totalFee === 'number') {
                balance = record.totalFee - paidAmount;
            } else {
                balance = record.status === 'Pending' ? paidAmount : 0;
            }

            const balanceCell = row.insertCell(7);
            balanceCell.textContent = formatCurrency(balance);
            if (balance > 0) balanceCell.style.color = '#dc3545';
            else if (balance === 0) balanceCell.style.color = '#28a745';

            // History button
            const historyCell = row.insertCell(8);
            const historyBtn = document.createElement('button');
            historyBtn.textContent = 'History';
            historyBtn.className = 'history-btn';
            historyBtn.dataset.roll = record.rollNumber || '';
            historyBtn.addEventListener('click', () => openHistory(record.rollNumber || record.id));
            historyCell.appendChild(historyBtn);
        });
    };

    // 4. Implement Filtering/Searching Logic
    const applyFilters = () => {
        const allRecords = getFeeRecords();
        const nameFilter = filterNameInput.value.toLowerCase();
        const statusFilter = filterStatusSelect.value;

        const filtered = allRecords.filter(record => {
            const matchesName = record.name.toLowerCase().includes(nameFilter);
            const matchesStatus = statusFilter === '' || record.status === statusFilter;
            return matchesName && matchesStatus;
        });

        renderRecords(filtered);
    };

    // --- History modal logic ---
    const historyModal = document.getElementById('history-modal');
    const historyBody = document.getElementById('history-body');
    const historyStudentName = document.getElementById('history-student-name');
    const historyClose = document.getElementById('history-close');

    const openHistory = (rollOrId) => {
        const records = getFeeRecords();
        // Try to match by rollNumber first, fall back to id
        const rec = records.find(r => (r.rollNumber && r.rollNumber === rollOrId) || r.id === rollOrId);
        if (!rec) return;

        historyStudentName.textContent = `${rec.name} (${rec.rollNumber || rec.id})`;

        // Build payments list: use payments array if available, otherwise single legacy payment
        let payments = [];
        if (Array.isArray(rec.payments) && rec.payments.length) {
            payments = rec.payments.slice();
        } else {
            // legacy: use amount field as single payment
            payments = [{ id: rec.id || Date.now(), amount: (typeof rec.amount === 'number' ? rec.amount : parseFloat(rec.amount) || 0), date: rec.date || '-', status: rec.status || '-' }];
        }

        // Clear and populate
        historyBody.innerHTML = '';
        payments.forEach((p, idx) => {
            const tr = document.createElement('tr');
            const c1 = document.createElement('td'); c1.textContent = idx + 1; tr.appendChild(c1);
            const c2 = document.createElement('td'); c2.textContent = (typeof p.amount === 'number' ? `₹ ${p.amount.toFixed(2)}` : `₹ ${parseFloat(p.amount).toFixed(2)}`); tr.appendChild(c2);
            const c3 = document.createElement('td'); c3.textContent = p.date || '-'; tr.appendChild(c3);
            const c4 = document.createElement('td'); c4.textContent = p.status || '-'; tr.appendChild(c4);
            historyBody.appendChild(tr);
        });

        historyModal.classList.remove('hidden');
    };

    const closeHistory = () => {
        historyModal.classList.add('hidden');
    };

    historyClose.addEventListener('click', closeHistory);
    historyModal.addEventListener('click', (e) => {
        if (e.target === historyModal) closeHistory();
    });

    // --- Event Listeners ---

    // A. Handle Form Submission (Add Record)
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        // Collect values
        const roll = document.getElementById('roll-number').value.trim();
        const name = document.getElementById('student-name').value.trim();
        const amountRaw = parseFloat(document.getElementById('fee-amount').value);
        const amount = !isNaN(amountRaw) ? amountRaw : 0;
        const totalFeeRaw = parseFloat(document.getElementById('total-fee').value);
        const totalFee = !isNaN(totalFeeRaw) ? totalFeeRaw : undefined;
        const date = document.getElementById('payment-date').value;
        const status = document.getElementById('status').value;

        const records = getFeeRecords();

        // Try to find existing student by roll number (exact match). Prefer roll number matching.
        const existingIndex = records.findIndex(r => r.rollNumber && r.rollNumber.toString() === roll.toString());

        const payment = { id: Date.now(), amount, date, status };

        if (existingIndex > -1) {
            const existing = records[existingIndex];

            // Ensure payments array
            if (!Array.isArray(existing.payments)) existing.payments = [];
            existing.payments.push(payment);

            // Recalculate aggregate amount for compatibility
            existing.amount = existing.payments.reduce((s, p) => s + (typeof p.amount === 'number' ? p.amount : parseFloat(p.amount) || 0), 0);

            // Update totalFee if provided
            if (typeof totalFee === 'number') existing.totalFee = totalFee;

            // Update last payment date and status
            existing.date = date;
            existing.status = status;

            records[existingIndex] = existing;
        } else {
            // New student record with payments array
            const newRecord = {
                id: Date.now(),
                rollNumber: roll,
                name,
                payments: [payment],
                amount, // aggregate for legacy
                totalFee: typeof totalFee === 'number' ? totalFee : undefined,
                date,
                status,
            };
            records.push(newRecord);
        }

        saveFeeRecords(records);
        form.reset();

        // Re-render the list after adding/updating the record
        applyFilters();
    });

    // B. Handle Filter Changes
    filterNameInput.addEventListener('input', applyFilters);
    filterStatusSelect.addEventListener('change', applyFilters);

    // Initial load of records
    applyFilters();
});