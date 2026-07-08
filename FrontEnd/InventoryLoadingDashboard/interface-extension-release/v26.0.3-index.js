import {
    initializeBlock,
    useBase,
    useRecords,
    expandRecord,
} from '@airtable/blocks/interface/ui';
import React, {useEffect, useMemo, useState} from 'react';
import './style.css';

const TABLE_NAMES = {
    submissions: 'INVENTORY SUBMISSIONS',
    draftItems: 'DRAFT ITEMS',
    designs: 'DESIGNS',
    productTypes: 'PRODUCT TYPES',
    locations: 'INVENTORY LOCATIONS',
    contacts: 'NOTIFICATION CONTACTS',
};

const STATUS = {
    submissionStatus: 'Draft Intake',
    parserStatus: 'Not Parsed',
    draftStatusWaiting: 'Draft',
    draftStatusReady: 'Ready for Review',
    processingStatusWaiting: 'Not Processed',
};

const LOGO_URL = 'https://raw.githubusercontent.com/adcibctech-ux/POS/main/2026%20LOGO%20TRANSPARENT-CROPPED.png';

const DESIGN_FORM_URL = 'https://airtable.com/appOuXOVKVDx2LVji/paghOBkG6Hu1ktvPC';
const PRODUCT_TYPE_FORM_URL = 'https://airtable.com/appOuXOVKVDx2LVji/pagHhaXIbxc0az57X';

const COLORS = [
    {
        code: 'BLK',
        label: 'Black',
    },
    {
        code: 'WHT',
        label: 'White',
    },
    {
        code: 'GRY',
        label: 'Grey',
    },
    {
        code: 'COL',
        label: 'Color',
    },
];

const SIZES = [
    {label: 'OS', skuCode: 'ONE', fieldCode: 'ONE'},
    {label: 'YXS', skuCode: 'YXS', fieldCode: 'YXS'},
    {label: 'YS', skuCode: 'YSM', fieldCode: 'YSM'},
    {label: 'YM', skuCode: 'YMD', fieldCode: 'YMD'},
    {label: 'YL', skuCode: 'YLG', fieldCode: 'YLG'},
    {label: 'YXL', skuCode: 'YXL', fieldCode: 'YXL'},
    {label: 'XS', skuCode: 'AXS', fieldCode: 'AXS'},
    {label: 'SM', skuCode: 'ASM', fieldCode: 'ASM'},
    {label: 'MD', skuCode: 'AMD', fieldCode: 'AMD'},
    {label: 'LG', skuCode: 'ALG', fieldCode: 'ALG'},
    {label: 'XL', skuCode: 'AXL', fieldCode: 'AXL'},
    {label: '2X', skuCode: 'A2X', fieldCode: 'A2X'},
];

const NOC_SIZE = {label: 'OS', skuCode: 'ONE', fieldCode: 'ONE'};

const EXCLUDED_PRODUCT_TYPE_STATUSES = new Set(['Rejected', 'Deprecated']);
const EXCLUDED_DESIGN_STATUSES = new Set(['Archived', 'Deprecated']);

function RequiredMark() {
    return <span className="required-mark">*</span>;
}

function getTableOrNull(base, tableName) {
    try {
        return base.getTableByName(tableName);
    } catch (error) {
        return null;
    }
}

function getCellValue(record, fieldName) {
    try {
        return record.getCellValue(fieldName);
    } catch (error) {
        return null;
    }
}

function getCellText(record, fieldName) {
    try {
        return record.getCellValueAsString(fieldName) || '';
    } catch (error) {
        return '';
    }
}

function getSelectName(record, fieldName) {
    const value = getCellValue(record, fieldName);
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value.name || '';
}

function getCheckbox(record, fieldName) {
    return Boolean(getCellValue(record, fieldName));
}

function sortByText(records, fieldName) {
    return [...records].sort((a, b) => {
        const aText = getCellText(a, fieldName).toLowerCase();
        const bText = getCellText(b, fieldName).toLowerCase();
        return aText.localeCompare(bText);
    });
}

function numberOrNull(value) {
    if (value === '' || value === null || value === undefined) return null;
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) return null;
    return numericValue;
}

function currencyOrNull(value) {
    if (value === '' || value === null || value === undefined) return null;
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) return null;
    return numericValue;
}

function formatMoney(value) {
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) return '—';

    return numericValue.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
    });
}

function isPositiveQuantity(value) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue > 0;
}

function buildEmptyQuantities() {
    const quantities = {};

    for (const color of COLORS) {
        for (const size of SIZES) {
            quantities[`${color.code}_${size.fieldCode}`] = '';
        }
    }

    quantities[`NOC_${NOC_SIZE.fieldCode}`] = '';

    return quantities;
}

function buildQuantityFieldName(colorCode, sizeFieldCode) {
    return `${colorCode} ${sizeFieldCode} Qty`;
}

function countQuantityUnits(quantities) {
    let total = 0;

    for (const value of Object.values(quantities)) {
        const numericValue = Number(value);
        if (Number.isFinite(numericValue) && numericValue > 0) {
            total += numericValue;
        }
    }

    return total;
}

function countQuantityCells(quantities) {
    let total = 0;

    for (const value of Object.values(quantities)) {
        if (isPositiveQuantity(value)) {
            total += 1;
        }
    }

    return total;
}

function getDraftValidationClass(validationStatus) {
    if (validationStatus === 'Error') return 'pill pill-error';
    if (validationStatus === 'Warning') return 'pill pill-warning';
    if (validationStatus === 'Valid') return 'pill pill-success';
    return 'pill pill-neutral';
}

function getDraftRowClass(validationStatus) {
    if (validationStatus === 'Error') return 'draft-row draft-row-error';
    if (validationStatus === 'Warning') return 'draft-row draft-row-warning';
    return 'draft-row';
}

async function updateRecordsInBatches(table, updates) {
    const batchSize = 50;

    for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        await table.updateRecordsAsync(batch);
    }
}

function MissingSetup({missingTables}) {
    return (
        <div className="app-shell">
            <div className="setup-card">
                <h1>Missing Interface Source Tables</h1>
                <p>
                    This dashboard needs all six source tables selected in the Airtable Interface custom element settings.
                </p>

                <div className="missing-list">
                    {missingTables.map((tableName) => (
                        <div key={tableName} className="missing-item">
                            {tableName}
                        </div>
                    ))}
                </div>

                <p className="muted">
                    Add the missing table(s) in the right sidebar under <strong>Data → Table</strong>, then refresh the interface.
                </p>
            </div>
        </div>
    );
}

function InventoryDashboard() {
    const base = useBase();

    const tables = {
        submissions: getTableOrNull(base, TABLE_NAMES.submissions),
        draftItems: getTableOrNull(base, TABLE_NAMES.draftItems),
        designs: getTableOrNull(base, TABLE_NAMES.designs),
        productTypes: getTableOrNull(base, TABLE_NAMES.productTypes),
        locations: getTableOrNull(base, TABLE_NAMES.locations),
        contacts: getTableOrNull(base, TABLE_NAMES.contacts),
    };

    const missingTables = Object.entries(tables)
        .filter(([, table]) => !table)
        .map(([key]) => TABLE_NAMES[key]);

    if (missingTables.length > 0) {
        return <MissingSetup missingTables={missingTables} />;
    }

    return <DashboardWithTables tables={tables} />;
}

function DashboardWithTables({tables}) {
    const submissionRecords = useRecords(tables.submissions);
    const draftItemRecords = useRecords(tables.draftItems);
    const designRecords = useRecords(tables.designs);
    const productTypeRecords = useRecords(tables.productTypes);
    const locationRecords = useRecords(tables.locations);
    const contactRecords = useRecords(tables.contacts);

    const designs = useMemo(() => {
        return sortByText(
            designRecords.filter((record) => {
                const active = getCheckbox(record, 'Active?');
                const status = getSelectName(record, 'Design Status');
                return active && !EXCLUDED_DESIGN_STATUSES.has(status);
            }),
            'Design Name'
        );
    }, [designRecords]);

    const productTypes = useMemo(() => {
        return sortByText(
            productTypeRecords.filter((record) => {
                const status = getSelectName(record, 'Product Type Status');
                return !EXCLUDED_PRODUCT_TYPE_STATUSES.has(status);
            }),
            'Product Type Name'
        );
    }, [productTypeRecords]);

    const locations = useMemo(() => {
        return sortByText(
            locationRecords.filter((record) => getCheckbox(record, 'Active')),
            'Inventory Location'
        );
    }, [locationRecords]);

    const contacts = useMemo(() => {
        return sortByText(contactRecords, 'Employee');
    }, [contactRecords]);

    const draftItemsWaitingForReview = useMemo(() => {
        return draftItemRecords.filter((record) => {
            const draftStatus = getSelectName(record, 'Draft Status');
            const processingStatus = getSelectName(record, 'Processing Status');

            return (
                draftStatus === STATUS.draftStatusWaiting &&
                processingStatus === STATUS.processingStatusWaiting
            );
        });
    }, [draftItemRecords]);

    const draftSummary = useMemo(() => {
        const errors = draftItemsWaitingForReview.filter(
            (record) => getSelectName(record, 'Validation Status') === 'Error'
        );

        const warnings = draftItemsWaitingForReview.filter(
            (record) => getSelectName(record, 'Validation Status') === 'Warning'
        );

        const totalUnits = draftItemsWaitingForReview.reduce((sum, record) => {
            const quantity = Number(getCellValue(record, 'Starting Production Quantity') || 0);
            return sum + quantity;
        }, 0);

        return {
            count: draftItemsWaitingForReview.length,
            errors: errors.length,
            warnings: warnings.length,
            totalUnits,
        };
    }, [draftItemsWaitingForReview]);

    const [selectedDesignId, setSelectedDesignId] = useState('');
    const [selectedProductTypeId, setSelectedProductTypeId] = useState('');
    const [selectedLocationId, setSelectedLocationId] = useState('');
    const [selectedSubmitterId, setSelectedSubmitterId] = useState('');
    const [selectedReviewerId, setSelectedReviewerId] = useState('');
    const [unitPrice, setUnitPrice] = useState('');
    const [unitCost, setUnitCost] = useState('');
    const [submissionNotes, setSubmissionNotes] = useState('');
    const [quantities, setQuantities] = useState(buildEmptyQuantities);
    const [creatingSubmission, setCreatingSubmission] = useState(false);
    const [submittingReview, setSubmittingReview] = useState(false);
    const [formMessage, setFormMessage] = useState(null);
    const [parserMessage, setParserMessage] = useState(null);
    const [trackedSubmissionId, setTrackedSubmissionId] = useState('');
    const [reviewMessage, setReviewMessage] = useState(null);

    const totalQuantityUnits = countQuantityUnits(quantities);
    const totalQuantityCells = countQuantityCells(quantities);

    const selectedDesign = designs.find((record) => record.id === selectedDesignId);
    const selectedProductType = productTypes.find((record) => record.id === selectedProductTypeId);

    const canSubmitSubmission =
        Boolean(selectedSubmitterId) &&
        Boolean(selectedDesignId) &&
        Boolean(selectedProductTypeId) &&
        Boolean(selectedLocationId) &&
        currencyOrNull(unitPrice) !== null &&
        currencyOrNull(unitCost) !== null &&
        totalQuantityUnits > 0;

    useEffect(() => {
        if (!trackedSubmissionId) {
            return;
        }

        const trackedSubmission = submissionRecords.find(
            (record) => record.id === trackedSubmissionId
        );

        if (!trackedSubmission) {
            setParserMessage({
                type: 'warning',
                text: 'Draft items being created...',
            });
            return;
        }

        const parserStatus = getSelectName(trackedSubmission, 'Parser Status');
        const linkedDraftItems = getCellValue(trackedSubmission, 'Item Drafts');

        const draftItemCount = Array.isArray(linkedDraftItems)
            ? linkedDraftItems.length
            : 0;

        if (parserStatus === 'Failed') {
            setParserMessage({
                type: 'error',
                text: 'Draft item creation failed. IT has been notified.',
            });
            return;
        }

        if (
            (parserStatus === 'Parsed' || parserStatus === 'Needs Review') &&
            draftItemCount > 0
        ) {
            setParserMessage({
                type: 'success',
                text: 'Draft items created.',
            });
            return;
        }

        setParserMessage({
            type: 'warning',
            text: 'Draft items being created...',
        });
    }, [trackedSubmissionId, submissionRecords]);

    function setQuantityValue(key, value) {
        if (value === '') {
            setQuantities((previous) => ({...previous, [key]: ''}));
            return;
        }

        const numericValue = Number(value);

        if (!Number.isFinite(numericValue) || numericValue < 0) {
            return;
        }

        setQuantities((previous) => ({...previous, [key]: value}));
    }

    function resetSubmissionForm() {
        setSelectedDesignId('');
        setSelectedProductTypeId('');
        setSelectedLocationId('');
        setUnitPrice('');
        setUnitCost('');
        setSubmissionNotes('');
        setQuantities(buildEmptyQuantities());
    }

    function validateSubmissionForm() {
        const errors = [];

        if (!selectedSubmitterId) errors.push('Choose who is submitting this batch.');
        if (!selectedDesignId) errors.push('Choose a design.');
        if (!selectedProductTypeId) errors.push('Choose a product type.');
        if (!selectedLocationId) errors.push('Choose a production location.');
        if (currencyOrNull(unitPrice) === null) errors.push('Enter a valid unit price.');
        if (currencyOrNull(unitCost) === null) errors.push('Enter a valid unit cost.');
        if (totalQuantityUnits <= 0) errors.push('Enter at least one production quantity greater than 0.');

        return errors;
    }

    async function createInventorySubmission() {
        setFormMessage(null);
        setParserMessage(null);
        setTrackedSubmissionId('');

        const validationErrors = validateSubmissionForm();

        if (validationErrors.length > 0) {
            setFormMessage({
                type: 'error',
                text: validationErrors.join(' '),
            });
            return;
        }

        const fields = {
            'Submission Status': {name: STATUS.submissionStatus},
            'Parser Status': {name: STATUS.parserStatus},
            Design: [{id: selectedDesignId}],
            'Product Type': [{id: selectedProductTypeId}],
            'Production Location': [{id: selectedLocationId}],
            'Submitted By': [{id: selectedSubmitterId}],
            'Submitted At': new Date(),
            'Unit Price': currencyOrNull(unitPrice),
            'Unit Cost': currencyOrNull(unitCost),
        };

        if (submissionNotes.trim()) {
            fields['Submission Notes'] = submissionNotes.trim();
        }

        for (const color of COLORS) {
            for (const size of SIZES) {
                const key = `${color.code}_${size.fieldCode}`;
                const quantityValue = numberOrNull(quantities[key]);

                if (quantityValue !== null && quantityValue > 0) {
                    fields[buildQuantityFieldName(color.code, size.fieldCode)] = quantityValue;
                }
            }
        }

        const nocQuantity = numberOrNull(quantities[`NOC_${NOC_SIZE.fieldCode}`]);
        if (nocQuantity !== null && nocQuantity > 0) {
            fields[buildQuantityFieldName('NOC', NOC_SIZE.fieldCode)] = nocQuantity;
        }

        try {
            setCreatingSubmission(true);
            const recordId = await tables.submissions.createRecordAsync(fields);

            setTrackedSubmissionId(recordId);

            setFormMessage({
                type: 'success',
                text: `Inventory submission created successfully. Airtable record ID: ${recordId}`,
            });

            setParserMessage({
                type: 'warning',
                text: 'Draft items being created...',
            });

            resetSubmissionForm();
        } catch (error) {
            setFormMessage({
                type: 'error',
                text: `Failed to create inventory submission: ${error.message}`,
            });
        } finally {
            setCreatingSubmission(false);
        }
    }

    function openDraftItem(record) {
        try {
            expandRecord(record);
        } catch (error) {
            setReviewMessage({
                type: 'error',
                text: `Failed to open draft item: ${error.message}`,
            });
        }
    }

    async function submitDraftItemsForReview() {
        setReviewMessage(null);

        if (!selectedReviewerId) {
            setReviewMessage({
                type: 'error',
                text: 'Choose who reviewed these draft items before submitting them for review.',
            });
            return;
        }

        if (draftItemsWaitingForReview.length === 0) {
            setReviewMessage({
                type: 'error',
                text: 'There are no draft items waiting for review.',
            });
            return;
        }

        if (draftSummary.errors > 0) {
            setReviewMessage({
                type: 'error',
                text: 'Cannot submit while draft items have Validation Status = Error. Open and fix the error records first.',
            });
            return;
        }

        const updates = draftItemsWaitingForReview.map((record) => ({
            id: record.id,
            fields: {
                'Draft Status': {name: STATUS.draftStatusReady},
                'Reviewed By': [{id: selectedReviewerId}],
                'Reviewed At': new Date(),
            },
        }));

        try {
            setSubmittingReview(true);
            await updateRecordsInBatches(tables.draftItems, updates);

            setReviewMessage({
                type: 'success',
                text: `${updates.length} draft item(s) submitted for review.`,
            });
        } catch (error) {
            setReviewMessage({
                type: 'error',
                text: `Failed to submit draft items for review: ${error.message}`,
            });
        } finally {
            setSubmittingReview(false);
        }
    }

    return (
        <div className="app-shell">
            <header
                className="dashboard-header"
                style={{
                    background: '#050505',
                    color: '#ffffff',
                    borderColor: '#2c2c2c',
                }}
            >
                <div className="brand-lockup">
                   <img
                        src={LOGO_URL}
                        alt="ADC IBC logo"
                        className="brand-logo"
                    />
                    <div>
                        <div
                            className="eyebrow"
                            style={{color: '#c8ad7f'}}
                        >
                            ADC|IBC Merchandise Management
                        </div>
                        <h1>Inventory Loading Dashboard</h1>
                        <p style={{color: '#e7dfd2'}}>
                            Add new merchandise to inventory in batches, review generated draft items,
                            and submit finalized draft records for IT processing.
                        </p>
                    </div>
                </div>

                <div className="header-actions">
                    <a className="secondary-link" href={DESIGN_FORM_URL} target="_blank" rel="noreferrer">
                        Add Design
                    </a>
                    <a className="secondary-link" href={PRODUCT_TYPE_FORM_URL} target="_blank" rel="noreferrer">
                        Add Product Type
                    </a>
                </div>
            </header>

            <main className="dashboard-grid">
                <section className="panel panel-primary">
                    <div className="panel-header">
                        <div>
                            <div className="section-kicker">Section 1</div>
                            <h2>Add New Inventory</h2>
                            <p>
                                Create one raw inventory submission batch. Product images are added later
                                in Section 2 by opening the generated draft item record.
                            </p>
                            <p className="required-legend">
                                <RequiredMark /> Required field
                            </p>
                        </div>

                        <div className="summary-card">
                            <span>Total units</span>
                            <strong>{totalQuantityUnits}</strong>
                            <small>{totalQuantityCells} filled size/color cell(s)</small>
                        </div>
                    </div>

                    <div className="form-grid">
                        <label className="field">
                            <span>Submitted By <RequiredMark /></span>
                            <select
                                value={selectedSubmitterId}
                                onChange={(event) => setSelectedSubmitterId(event.target.value)}
                                required
                            >
                                <option value="">Choose contact...</option>
                                {contacts.map((record) => (
                                    <option key={record.id} value={record.id}>
                                        {getCellText(record, 'Employee')}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="field">
                            <span>Design <RequiredMark /></span>
                            <select
                                value={selectedDesignId}
                                onChange={(event) => setSelectedDesignId(event.target.value)}
                                required
                            >
                                <option value="">Choose design...</option>
                                {designs.map((record) => (
                                    <option key={record.id} value={record.id}>
                                        {getCellText(record, 'Design Name')} - {getCellText(record, 'Design Code')}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="field">
                            <span>Product Type <RequiredMark /></span>
                            <select
                                value={selectedProductTypeId}
                                onChange={(event) => setSelectedProductTypeId(event.target.value)}
                                required
                            >
                                <option value="">Choose product type...</option>
                                {productTypes.map((record) => (
                                    <option key={record.id} value={record.id}>
                                        {getCellText(record, 'Product Type Name')} - {getCellText(record, 'Product Type Code')}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="field">
                            <span>Production Location <RequiredMark /></span>
                            <select
                                value={selectedLocationId}
                                onChange={(event) => setSelectedLocationId(event.target.value)}
                                required
                            >
                                <option value="">Choose location...</option>
                                {locations.map((record) => (
                                    <option key={record.id} value={record.id}>
                                        {getCellText(record, 'Inventory Location')}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="field">
                            <span>Unit Price <RequiredMark /></span>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={unitPrice}
                                onChange={(event) => setUnitPrice(event.target.value)}
                                placeholder="0.00"
                                required
                            />
                        </label>

                        <label className="field">
                            <span>Unit Cost <RequiredMark /></span>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={unitCost}
                                onChange={(event) => setUnitCost(event.target.value)}
                                placeholder="0.00"
                                required
                            />
                        </label>
                    </div>

                    <div className="selection-preview">
                        <div>
                            <span>Selected design</span>
                            <strong>
                                {selectedDesign
                                    ? `${getCellText(selectedDesign, 'Design Name')} - ${getCellText(selectedDesign, 'Design Code')}`
                                    : 'None selected'}
                            </strong>
                        </div>

                        <div>
                            <span>Selected product type</span>
                            <strong>
                                {selectedProductType
                                    ? `${getCellText(selectedProductType, 'Product Type Name')} - ${getCellText(selectedProductType, 'Product Type Code')}`
                                    : 'None selected'}
                            </strong>
                        </div>

                        <div>
                            <span>Estimated retail value</span>
                            <strong>{formatMoney(totalQuantityUnits * Number(unitPrice || 0))}</strong>
                        </div>

                        <div>
                            <span>Estimated cost value</span>
                            <strong>{formatMoney(totalQuantityUnits * Number(unitCost || 0))}</strong>
                        </div>
                    </div>

                    <div className="quantity-section">
                        <div className="subsection-heading">
                            <div>
                                <h3>Add Quantities</h3>
                                <p>
                                    At least one quantity box must be greater than 0 to submit.
                                </p>
                            </div>
                        </div>

                        <div className="quantity-matrix-wrap">
                            <table className="quantity-matrix">
                                <thead>
                                    <tr>
                                        <th>Color</th>
                                        {SIZES.map((size) => (
                                            <th key={size.fieldCode}>
                                                <span>{size.label}</span>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>

                                <tbody>
                                    {COLORS.map((color) => (
                                        <tr key={color.code}>
                                            <th>
                                                <span className="color-code">{color.code}</span>
                                                <small>{color.label}</small>
                                                <small>{color.note}</small>
                                            </th>

                                            {SIZES.map((size) => {
                                                const key = `${color.code}_${size.fieldCode}`;

                                                return (
                                                    <td key={key}>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="1"
                                                            value={quantities[key]}
                                                            onChange={(event) => setQuantityValue(key, event.target.value)}
                                                            aria-label={`${color.code} ${size.label} quantity`}
                                                        />
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}

                                    <tr className="noc-row">
                                        <th>
                                            <span className="color-code">NOC</span>
                                            <small>Non-color items such as access passes.</small>
                                        </th>

                                        {SIZES.map((size) => {
                                            if (size.fieldCode !== NOC_SIZE.fieldCode) {
                                                return <td key={`NOC_${size.fieldCode}`} className="disabled-cell">—</td>;
                                            }

                                            const key = `NOC_${NOC_SIZE.fieldCode}`;

                                            return (
                                                <td key={key}>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="1"
                                                        value={quantities[key]}
                                                        onChange={(event) => setQuantityValue(key, event.target.value)}
                                                        aria-label="NOC OS quantity"
                                                    />
                                                </td>
                                            );
                                        })}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <label className="field notes-field">
                        <span>Submission Notes</span>
                        <textarea
                            value={submissionNotes}
                            onChange={(event) => setSubmissionNotes(event.target.value)}
                            placeholder="Optional notes for IT processing"
                        />
                    </label>

                    {formMessage && (
                        <div className={`message message-${formMessage.type}`}>
                            {formMessage.text}
                        </div>
                    )}

                    {parserMessage && (
                        <div className={`message message-${parserMessage.type}`}>
                            {parserMessage.text}
                        </div>
                    )}

                    <div className="button-row">
                        <button
                            className="primary-button"
                            onClick={createInventorySubmission}
                            disabled={creatingSubmission || !canSubmitSubmission}
                            title={!canSubmitSubmission ? 'Complete all required fields and enter at least one quantity greater than 0.' : ''}
                        >
                            {creatingSubmission ? 'Creating Submission...' : 'Create Inventory Submission'}
                        </button>

                        <button
                            className="ghost-button"
                            onClick={resetSubmissionForm}
                            disabled={creatingSubmission}
                        >
                            Clear Form
                        </button>
                    </div>
                </section>

                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <div className="section-kicker">Section 2</div>
                            <h2>Review Generated Draft Items</h2>
                            <p>
                                Open draft records to edit details and upload product images. Product images are optional.
                                Only one draft item per image/color group needs an image uploaded; IT can adjust placement during processing.
                            </p>
                        </div>

                        <div className="draft-stats">
                            <div>
                                <span>Waiting</span>
                                <strong>{draftSummary.count}</strong>
                            </div>
                            <div>
                                <span>Warnings</span>
                                <strong>{draftSummary.warnings}</strong>
                            </div>
                            <div>
                                <span>Errors</span>
                                <strong>{draftSummary.errors}</strong>
                            </div>
                            <div>
                                <span>Units</span>
                                <strong>{draftSummary.totalUnits}</strong>
                            </div>
                        </div>
                    </div>

                    <div className="review-toolbar">
                        <label className="field reviewer-field">
                            <span>Reviewed By</span>
                            <select
                                value={selectedReviewerId}
                                onChange={(event) => setSelectedReviewerId(event.target.value)}
                            >
                                <option value="">Choose reviewer...</option>
                                {contacts.map((record) => (
                                    <option key={record.id} value={record.id}>
                                        {getCellText(record, 'Employee')}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <button
                            className="primary-button"
                            onClick={submitDraftItemsForReview}
                            disabled={
                                submittingReview ||
                                draftItemsWaitingForReview.length === 0 ||
                                draftSummary.errors > 0
                            }
                        >
                            {submittingReview ? 'Submitting...' : 'Submit Visible Draft Items for Review'}
                        </button>
                    </div>

                    {reviewMessage && (
                        <div className={`message message-${reviewMessage.type}`}>
                            {reviewMessage.text}
                        </div>
                    )}

                    {draftSummary.errors > 0 && (
                        <div className="message message-error">
                            Draft items with Validation Status = Error must be fixed before this batch can be submitted for review.
                        </div>
                    )}

                    {draftItemsWaitingForReview.length === 0 ? (
                        <div className="empty-state">
                            <h3>No draft items waiting for review</h3>
                            <p>
                                Once SUB-1 parses a new inventory submission, generated draft items will appear here.
                            </p>
                        </div>
                    ) : (
                        <div className="draft-table-wrap">
                            <table className="draft-table">
                                <thead>
                                    <tr>
                                        <th>Action</th>
                                        <th>Draft SKU</th>
                                        <th>Item Name</th>
                                        <th>Variant</th>
                                        <th>Color</th>
                                        <th>Size</th>
                                        <th>Qty</th>
                                        <th>Validation</th>
                                        <th>Notes</th>
                                        <th>Submitted By</th>
                                        <th>Submitted At</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {draftItemsWaitingForReview.map((record) => {
                                        const validationStatus = getSelectName(record, 'Validation Status');

                                        return (
                                            <tr key={record.id} className={getDraftRowClass(validationStatus)}>
                                                <td>
                                                    <button
                                                        className="small-button"
                                                        onClick={() => openDraftItem(record)}
                                                    >
                                                        Open
                                                    </button>
                                                </td>
                                                <td className="sku-cell">{getCellText(record, 'Draft SKU')}</td>
                                                <td>{getCellText(record, 'Item Name')}</td>
                                                <td>{getCellText(record, 'Variant Name')}</td>
                                                <td>{getCellText(record, 'Color Family')}</td>
                                                <td>{getCellText(record, 'Size')}</td>
                                                <td>{getCellText(record, 'Starting Production Quantity')}</td>
                                                <td>
                                                    <span className={getDraftValidationClass(validationStatus)}>
                                                        {validationStatus || 'Not Checked'}
                                                    </span>
                                                </td>
                                                <td className="notes-cell">{getCellText(record, 'Validation Notes')}</td>
                                                <td>{getCellText(record, 'Submitted By')}</td>
                                                <td>{getCellText(record, 'Submitted At')}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}

initializeBlock({interface: () => <InventoryDashboard />});
