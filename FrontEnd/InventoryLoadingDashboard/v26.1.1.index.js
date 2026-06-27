import {
    initializeBlock,
    useBase,
    useRecords,
    Box,
    Button,
    Heading,
    Text,
    expandRecord,
} from '@airtable/blocks/ui';
import React, {useMemo, useState} from 'react';
import './style.css';

const TABLES = {
    submissions: 'INVENTORY SUBMISSIONS',
    draftItems: 'DRAFT ITEMS',
    designs: 'DESIGNS',
    productTypes: 'PRODUCT TYPES',
    inventoryLocations: 'INVENTORY LOCATIONS',
    notificationContacts: 'NOTIFICATION CONTACTS',
};

const SUB_FIELDS = {
    submissionStatus: 'Submission Status',
    parserStatus: 'Parser Status',
    submittedBy: 'Submitted By',
    submittedAt: 'Submitted At',
    design: 'Design',
    productType: 'Product Type',
    productionLocation: 'Production Location',
    unitPrice: 'Unit Price',
    unitCost: 'Unit Cost',
    submissionNotes: 'Submission Notes',
};

const DRAFT_FIELDS = {
    draftSku: 'Draft SKU',
    draftStatus: 'Draft Status',
    inventorySubmission: 'Inventory Submission',
    submittedBy: 'Submitted By',
    submittedAt: 'Submitted At',
    designName: 'Design Name',
    productTypes: 'Product Type',
    colorFamily: 'Color Family',
    size: 'Size',
    startingQty: 'Starting Production Quantity',
    unitPrice: 'Unit Price',
    unitCost: 'Unit Cost',
    itemName: 'Item Name',
    variantName: 'Variant Name',
    validationStatus: 'Validation Status',
    productImage: 'Product Image',
    processingStatus: 'Processing Status',
};

const QUANTITY_COLORS = ['BLK', 'WHT', 'GRY', 'COL'];
const QUANTITY_SIZES = ['OS', 'YS', 'YM', 'YL', 'XS', 'SM', 'MD', 'LG', 'XL', '2X', '3X'];

const DESIGN_FORM_URL = '';
const PRODUCT_TYPE_FORM_URL = '';

function getTableOrNull(base, tableName) {
    try {
        return base.getTableByName(tableName);
    } catch (error) {
        return null;
    }
}

function getFieldOrNull(table, fieldName) {
    if (!table) return null;

    try {
        return table.getFieldByName(fieldName);
    } catch (error) {
        return null;
    }
}

function cellText(record, fieldName) {
    try {
        return record.getCellValueAsString(fieldName) || '';
    } catch (error) {
        return '';
    }
}

function statusBadgeClass(status) {
    if (status === 'Valid') return 'badge badge-valid';
    if (status === 'Warning') return 'badge badge-warning';
    if (status === 'Error') return 'badge badge-error';
    return 'badge';
}

function quantityFieldName(colorCode, sizeCode) {
    return `${colorCode} ${sizeCode} Qty`;
}

function cleanNumberInput(value) {
    if (value === '' || value === null || value === undefined) return null;

    const numberValue = Number(value);

    if (!Number.isFinite(numberValue)) return null;

    return numberValue;
}

function hasAnyPositiveQuantity(quantities, nocQty) {
    const matrixHasQty = Object.values(quantities).some((value) => {
        const numberValue = cleanNumberInput(value);
        return numberValue !== null && numberValue > 0;
    });

    const nocNumber = cleanNumberInput(nocQty);

    return matrixHasQty || (nocNumber !== null && nocNumber > 0);
}

function hasInvalidQuantity(quantities, nocQty) {
    const allValues = [...Object.values(quantities), nocQty];

    return allValues.some((value) => {
        if (value === '' || value === null || value === undefined) return false;

        const numberValue = Number(value);

        return !Number.isFinite(numberValue) || numberValue < 0 || !Number.isInteger(numberValue);
    });
}

function buildQuantityFields(quantities, nocQty) {
    const fields = {};

    for (const colorCode of QUANTITY_COLORS) {
        for (const sizeCode of QUANTITY_SIZES) {
            const key = quantityFieldName(colorCode, sizeCode);
            const numberValue = cleanNumberInput(quantities[key]);

            if (numberValue !== null && numberValue > 0) {
                fields[key] = numberValue;
            }
        }
    }

    const nocNumber = cleanNumberInput(nocQty);

    if (nocNumber !== null && nocNumber > 0) {
        fields['NOC OS Qty'] = nocNumber;
    }

    return fields;
}

function MissingSetupNotice({missingTables, missingSubmissionFields, missingDraftFields}) {
    if (
        missingTables.length === 0 &&
        missingSubmissionFields.length === 0 &&
        missingDraftFields.length === 0
    ) {
        return null;
    }

    return (
        <Box className="notice notice-error">
            <Heading size="small">Setup check needed</Heading>

            {missingTables.length > 0 && (
                <Box marginTop={2}>
                    <Text fontWeight="strong">Missing tables:</Text>
                    <ul>
                        {missingTables.map((tableName) => (
                            <li key={tableName}>{tableName}</li>
                        ))}
                    </ul>
                </Box>
            )}

            {missingSubmissionFields.length > 0 && (
                <Box marginTop={2}>
                    <Text fontWeight="strong">Missing INVENTORY SUBMISSIONS fields:</Text>
                    <ul>
                        {missingSubmissionFields.map((fieldName) => (
                            <li key={fieldName}>{fieldName}</li>
                        ))}
                    </ul>
                </Box>
            )}

            {missingDraftFields.length > 0 && (
                <Box marginTop={2}>
                    <Text fontWeight="strong">Missing DRAFT ITEMS fields:</Text>
                    <ul>
                        {missingDraftFields.map((fieldName) => (
                            <li key={fieldName}>{fieldName}</li>
                        ))}
                    </ul>
                </Box>
            )}
        </Box>
    );
}

function InventorySubmissionForm({
    submissionsTable,
    designsTable,
    productTypesTable,
    inventoryLocationsTable,
    notificationContactsTable,
}) {
    const submissionRecords = useRecords(submissionsTable);
    const designRecords = useRecords(designsTable);
    const productTypeRecords = useRecords(productTypesTable);
    const locationRecords = useRecords(inventoryLocationsTable);
    const contactRecords = useRecords(notificationContactsTable);

    const [submittedById, setSubmittedById] = useState('');
    const [designId, setDesignId] = useState('');
    const [productTypeId, setProductTypeId] = useState('');
    const [productionLocationId, setProductionLocationId] = useState('');
    const [unitPrice, setUnitPrice] = useState('');
    const [unitCost, setUnitCost] = useState('');
    const [submissionNotes, setSubmissionNotes] = useState('');
    const [quantities, setQuantities] = useState({});
    const [nocQty, setNocQty] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [lastSubmissionId, setLastSubmissionId] = useState('');
    const [banner, setBanner] = useState(null);

    const lastSubmissionRecord = useMemo(() => {
        if (!lastSubmissionId) return null;
        return submissionRecords.find((record) => record.id === lastSubmissionId) || null;
    }, [submissionRecords, lastSubmissionId]);

    const latestParserStatus = lastSubmissionRecord
        ? cellText(lastSubmissionRecord, SUB_FIELDS.parserStatus)
        : '';

    const latestSubmissionStatus = lastSubmissionRecord
        ? cellText(lastSubmissionRecord, SUB_FIELDS.submissionStatus)
        : '';

    const canSubmit =
        submittedById &&
        designId &&
        productTypeId &&
        productionLocationId &&
        unitPrice !== '' &&
        unitCost !== '' &&
        cleanNumberInput(unitPrice) !== null &&
        cleanNumberInput(unitCost) !== null &&
        hasAnyPositiveQuantity(quantities, nocQty) &&
        !hasInvalidQuantity(quantities, nocQty) &&
        !isSubmitting;

    function resetFormAfterSubmit() {
        setDesignId('');
        setProductTypeId('');
        setProductionLocationId('');
        setUnitPrice('');
        setUnitCost('');
        setSubmissionNotes('');
        setQuantities({});
        setNocQty('');
    }

    function updateQuantity(fieldName, value) {
        setQuantities((current) => ({
            ...current,
            [fieldName]: value,
        }));
    }

    async function createSubmission() {
        if (hasInvalidQuantity(quantities, nocQty)) {
            setBanner({
                type: 'error',
                message: 'Quantity fields must be whole numbers greater than or equal to zero.',
            });
            return;
        }

        if (!hasAnyPositiveQuantity(quantities, nocQty)) {
            setBanner({
                type: 'error',
                message: 'Enter at least one positive quantity before submitting.',
            });
            return;
        }

        if (!submittedById || !designId || !productTypeId || !productionLocationId) {
            setBanner({
                type: 'error',
                message: 'Submitted By, Design, Product Type, and Production Location are required.',
            });
            return;
        }

if (cleanNumberInput(unitPrice) === null || cleanNumberInput(unitCost) === null) {
    setBanner({
        type: 'error',
        message: 'Unit Price and Unit Cost are required and must be valid numbers.',
    });
    return;
}

        setIsSubmitting(true);
        setBanner({
            type: 'info',
            message: 'Creating inventory submission...',
        });

        try {
            const fields = {
                [SUB_FIELDS.submissionStatus]: {name: 'Draft Intake'},
                [SUB_FIELDS.parserStatus]: {name: 'Not Parsed'},
                [SUB_FIELDS.submittedBy]: [{id: submittedById}],
                [SUB_FIELDS.submittedAt]: new Date().toISOString(),
                [SUB_FIELDS.productType]: [{id: productTypeId}],
                [SUB_FIELDS.productionLocation]: [{id: productionLocationId}],
                ...buildQuantityFields(quantities, nocQty),
            };

            if (designId) {
                fields[SUB_FIELDS.design] = [{id: designId}];
            }

            const parsedPrice = cleanNumberInput(unitPrice);
            const parsedCost = cleanNumberInput(unitCost);

            if (parsedPrice !== null) {
                fields[SUB_FIELDS.unitPrice] = parsedPrice;
            }

            if (parsedCost !== null) {
                fields[SUB_FIELDS.unitCost] = parsedCost;
            }

            if (submissionNotes.trim()) {
                fields[SUB_FIELDS.submissionNotes] = submissionNotes.trim();
            }

            const newRecordId = await submissionsTable.createRecordAsync(fields);

            setLastSubmissionId(newRecordId);
            resetFormAfterSubmit();

            setBanner({
                type: 'success',
                message:
                    'Inventory submission created. SUB-1 will parse it through the Airtable automation. Images are optional and can be added later from the opened submission or draft item records.',
            });
        } catch (error) {
            setBanner({
                type: 'error',
                message: `Could not create inventory submission: ${error.message}`,
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Box className="card">
            <Box className="section-header">
                <Box>
                    <Heading size="medium">(1) Add New Inventory By Design + Product Type</Heading>
                    <Text textColor="light">
                        Add quantities by color/size. Images are optional and can be added later if needed.
                    </Text>
                </Box>

                <Box className="button-row">
                    <Button
                        size="small"
                        disabled={!DESIGN_FORM_URL}
                        onClick={() => window.open(DESIGN_FORM_URL, '_blank')}
                    >
                        + Add Design
                    </Button>

                    <Button
                        size="small"
                        disabled={!PRODUCT_TYPE_FORM_URL}
                        onClick={() => window.open(PRODUCT_TYPE_FORM_URL, '_blank')}
                    >
                        + Add Product Type
                    </Button>
                </Box>
            </Box>

            {banner && (
                <Box
                    className={`notice ${
                        banner.type === 'error'
                            ? 'notice-error'
                            : banner.type === 'success'
                            ? 'notice-success'
                            : 'notice-info'
                    }`}
                    marginTop={3}
                >
                    <Text>{banner.message}</Text>
                </Box>
            )}

            {lastSubmissionRecord && (
                <Box className="notice notice-info" marginTop={3}>
                    <Box className="section-header">
                        <Box>
                            <Text fontWeight="strong">Latest submission status</Text>
                            <Text>
                                Submission Status: {latestSubmissionStatus || '—'} | Parser Status:{' '}
                                {latestParserStatus || '—'}
                            </Text>
                        </Box>

                        <Button size="small" onClick={() => expandRecord(lastSubmissionRecord)}>
                            Open Submission
                        </Button>
                    </Box>
                </Box>
            )}

            <Box className="form-grid" marginTop={4}>
                <label className="form-field">
                    <span>Submitted By *</span>
                    <select value={submittedById} onChange={(event) => setSubmittedById(event.target.value)}>
                        <option value="">Select contact...</option>
                        {contactRecords.map((record) => (
                            <option key={record.id} value={record.id}>
                                {record.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="form-field">
                    <span>Design *</span>
                    <select value={designId} onChange={(event) => setDesignId(event.target.value)}>
                        <option value="">Select design...</option>
                        {designRecords.map((record) => (
                            <option key={record.id} value={record.id}>
                                {record.name}
                            </option>
                        ))}
                    </select>
                    <small>* = Required field.</small>
                </label>

                <label className="form-field">
                    <span>Product Type *</span>
                    <select value={productTypeId} onChange={(event) => setProductTypeId(event.target.value)}>
                        <option value="">Select product type...</option>
                        {productTypeRecords.map((record) => {
                            const status = cellText(record, 'Product Type Status');

                            return (
                                <option key={record.id} value={record.id}>
                                    {record.name}
                                    {status ? ` — ${status}` : ''}
                                </option>
                            );
                        })}
                    </select>
                </label>

                <label className="form-field">
                    <span>Production Location *</span>
                    <select
                        value={productionLocationId}
                        onChange={(event) => setProductionLocationId(event.target.value)}
                    >
                        <option value="">Select location...</option>
                        {locationRecords.map((record) => (
                            <option key={record.id} value={record.id}>
                                {record.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="form-field">
                    <span>Unit Price *</span>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={unitPrice}
                        onChange={(event) => setUnitPrice(event.target.value)}
                        placeholder="0.00"
                    />
                </label>

                <label className="form-field">
                    <span>Unit Cost *</span>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={unitCost}
                        onChange={(event) => setUnitCost(event.target.value)}
                        placeholder="0.00"
                    />
                </label>
            </Box>

            <label className="form-field full-width" style={{marginTop: 16}}>
                <span>Submission Notes</span>
                <textarea
                    value={submissionNotes}
                    onChange={(event) => setSubmissionNotes(event.target.value)}
                    placeholder="Optional notes for this inventory batch..."
                    rows={3}
                />
            </label>

            <Box marginTop={4}>
                <Heading size="small">Quantity Matrix</Heading>
                <Text textColor="light">
                    Enter whole-number quantities only. Leave blank for zero.
                </Text>

                <Box className="quantity-table-wrapper">
                    <table className="quantity-table">
                        <thead>
                            <tr>
                                <th>Color</th>
                                {QUANTITY_SIZES.map((sizeCode) => (
                                    <th key={sizeCode}>{sizeCode}</th>
                                ))}
                            </tr>
                        </thead>

                        <tbody>
                            {QUANTITY_COLORS.map((colorCode) => (
                                <tr key={colorCode}>
                                    <td className="color-cell">{colorCode}</td>
                                    {QUANTITY_SIZES.map((sizeCode) => {
                                        const fieldName = quantityFieldName(colorCode, sizeCode);

                                        return (
                                            <td key={fieldName}>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value={quantities[fieldName] || ''}
                                                    onChange={(event) =>
                                                        updateQuantity(fieldName, event.target.value)
                                                    }
                                                    className="qty-input"
                                                />
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}

                            <tr>
                                <td className="color-cell">NOC</td>
                                <td>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={nocQty}
                                        onChange={(event) => setNocQty(event.target.value)}
                                        className="qty-input"
                                    />
                                </td>
                                <td colSpan={QUANTITY_SIZES.length - 1} className="muted-cell">
                                    One-size / no-color quantity only
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </Box>
            </Box>

            <Box className="form-actions">
                <Button
                    variant="primary"
                    disabled={!canSubmit}
                    onClick={createSubmission}
                >
                    {isSubmitting ? 'Submitting...' : 'Submit Inventory Batch'}
                </Button>

                <Text textColor="light">
                    After submission, SUB-1 parses the batch into Draft Items. Use Open Submission only if optional images or details need to be added.
                </Text>
            </Box>
        </Box>
    );
}

function DraftItemsGrid({draftItemsTable}) {
    const draftRecords = useRecords(draftItemsTable);

    const visibleDrafts = draftRecords
        .filter((record) => {
            const draftStatus = cellText(record, DRAFT_FIELDS.draftStatus);
            const processingStatus = cellText(record, DRAFT_FIELDS.processingStatus);

            return draftStatus === 'Draft' && processingStatus === 'Not Processed';
        })
        .sort((a, b) => {
            return cellText(a, DRAFT_FIELDS.draftSku).localeCompare(
                cellText(b, DRAFT_FIELDS.draftSku)
            );
        });

    return (
        <Box className="card">
            <Box className="section-header">
                <Box>
                    <Heading size="medium">(2) Review Items for Submission</Heading>
                    <Text textColor="light">
                        Showing all draft items where Draft Status = Draft and Processing Status = Not Processed.
                    </Text>
                </Box>

                <Box className="count-pill">
                    {visibleDrafts.length} draft item{visibleDrafts.length === 1 ? '' : 's'}
                </Box>
            </Box>

            <Box className="notice notice-info" marginTop={3}>
                <Text>
                    To edit images or full record details, click <strong>Open</strong> on the draft item.
                    Image edits happen directly in the Airtable record detail panel.
                </Text>
            </Box>

            {visibleDrafts.length === 0 ? (
                <Box className="empty-state">
                    <Heading size="small">No draft items waiting for review</Heading>
                    <Text textColor="light">
                        Once Aud submits an inventory batch and SUB-1 parses it, draft items will appear here.
                    </Text>
                </Box>
            ) : (
                <Box className="draft-table-wrapper">
                    <table className="draft-table">
                        <thead>
                            <tr>
                                <th>Open</th>
                                <th>Draft SKU</th>
                                <th>Submitted By</th>
                                <th>Submitted At</th>
                                <th>Design</th>
                                <th>Product Type</th>
                                <th>Color</th>
                                <th>Size</th>
                                <th>Qty</th>
                                <th>Price</th>
                                <th>Cost</th>
                                <th>Item Name</th>
                                <th>Variant</th>
                                <th>Validation</th>
                            </tr>
                        </thead>

                        <tbody>
                            {visibleDrafts.map((record) => {
                                const validationStatus = cellText(record, DRAFT_FIELDS.validationStatus);

                                return (
                                    <tr key={record.id}>
                                        <td>
                                            <Button
                                                size="small"
                                                onClick={() => expandRecord(record)}
                                            >
                                                Open
                                            </Button>
                                        </td>
                                        <td>{cellText(record, DRAFT_FIELDS.draftSku)}</td>
                                        <td>{cellText(record, DRAFT_FIELDS.submittedBy)}</td>
                                        <td>{cellText(record, DRAFT_FIELDS.submittedAt)}</td>
                                        <td>{cellText(record, DRAFT_FIELDS.designName)}</td>
                                        <td>{cellText(record, DRAFT_FIELDS.productTypes)}</td>
                                        <td>{cellText(record, DRAFT_FIELDS.colorFamily)}</td>
                                        <td>{cellText(record, DRAFT_FIELDS.size)}</td>
                                        <td>{cellText(record, DRAFT_FIELDS.startingQty)}</td>
                                        <td>{cellText(record, DRAFT_FIELDS.unitPrice)}</td>
                                        <td>{cellText(record, DRAFT_FIELDS.unitCost)}</td>
                                        <td>{cellText(record, DRAFT_FIELDS.itemName)}</td>
                                        <td>{cellText(record, DRAFT_FIELDS.variantName)}</td>
                                        <td>
                                            <span className={statusBadgeClass(validationStatus)}>
                                                {validationStatus || '—'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </Box>
            )}
        </Box>
    );
}

function InventoryLoadingDashboard() {
    const base = useBase();

    const tables = {
        submissions: getTableOrNull(base, TABLES.submissions),
        draftItems: getTableOrNull(base, TABLES.draftItems),
        designs: getTableOrNull(base, TABLES.designs),
        productTypes: getTableOrNull(base, TABLES.productTypes),
        inventoryLocations: getTableOrNull(base, TABLES.inventoryLocations),
        notificationContacts: getTableOrNull(base, TABLES.notificationContacts),
    };

    const missingTables = Object.entries(tables)
        .filter(([, table]) => !table)
        .map(([key]) => TABLES[key]);

    const quantityFieldNames = [
        ...QUANTITY_COLORS.flatMap((colorCode) =>
            QUANTITY_SIZES.map((sizeCode) => quantityFieldName(colorCode, sizeCode))
        ),
        'NOC OS Qty',
    ];

    const missingSubmissionFields = tables.submissions
        ? [...Object.values(SUB_FIELDS), ...quantityFieldNames].filter((fieldName) => {
              return !getFieldOrNull(tables.submissions, fieldName);
          })
        : [];

    const missingDraftFields = tables.draftItems
        ? Object.values(DRAFT_FIELDS).filter((fieldName) => {
              return !getFieldOrNull(tables.draftItems, fieldName);
          })
        : [];

    const readyForSubmissionForm =
        tables.submissions &&
        tables.designs &&
        tables.productTypes &&
        tables.inventoryLocations &&
        tables.notificationContacts &&
        missingSubmissionFields.length === 0;

    const readyForDraftGrid = tables.draftItems && missingDraftFields.length === 0;

    return (
        <Box className="app-shell">
            <Box className="hero">
                <Box>
                    <Text className="eyebrow">ADC|IBC POS Backend</Text>
                    <Heading className="hero-title">Inventory Loading Dashboard</Heading>
                    <Text className="hero-subtitle">
                        Submit merch inventory batches, review generated draft items, and submit for IT processing.
                    </Text>
                </Box>
            </Box>

            <Box className="card">
                <Heading size="medium">Build Status</Heading>
                <Text textColor="light">
                    Version 2 creates inventory submissions and displays active draft items.
                </Text>

                <Box className="status-grid" marginTop={3}>
                    {Object.entries(tables).map(([key, table]) => (
                        <Box key={key} className={table ? 'status-card status-ok' : 'status-card status-missing'}>
                            <Text fontWeight="strong">{TABLES[key]}</Text>
                            <Text>{table ? 'Connected' : 'Missing'}</Text>
                        </Box>
                    ))}
                </Box>
            </Box>

            <MissingSetupNotice
                missingTables={missingTables}
                missingSubmissionFields={missingSubmissionFields}
                missingDraftFields={missingDraftFields}
            />

            {readyForSubmissionForm ? (
                <InventorySubmissionForm
                    submissionsTable={tables.submissions}
                    designsTable={tables.designs}
                    productTypesTable={tables.productTypes}
                    inventoryLocationsTable={tables.inventoryLocations}
                    notificationContactsTable={tables.notificationContacts}
                />
            ) : (
                <Box className="card">
                    <Heading size="medium">(1) Add New Inventory By Design + Product Type</Heading>
                    <Text textColor="light">
                        The form will load after required INVENTORY SUBMISSIONS fields are confirmed.
                    </Text>
                </Box>
            )}

            {readyForDraftGrid ? (
                <DraftItemsGrid draftItemsTable={tables.draftItems} />
            ) : (
                <Box className="card">
                    <Heading size="medium">(2) Review Items for Submission</Heading>
                    <Text textColor="light">
                        The draft grid will load after the required DRAFT ITEMS fields are confirmed.
                    </Text>
                </Box>
            )}
        </Box>
    );
}

initializeBlock(() => <InventoryLoadingDashboard />);
