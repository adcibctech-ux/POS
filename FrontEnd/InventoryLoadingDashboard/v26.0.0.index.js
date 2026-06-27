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
import React from 'react';
import './style.css';

const TABLES = {
    submissions: 'INVENTORY SUBMISSIONS',
    draftItems: 'DRAFT ITEMS',
    designs: 'DESIGNS',
    productTypes: 'PRODUCT TYPES',
    inventoryLocations: 'INVENTORY LOCATIONS',
    notificationContacts: 'NOTIFICATION CONTACTS',
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

function MissingSetupNotice({missingTables, missingDraftFields}) {
    if (missingTables.length === 0 && missingDraftFields.length === 0) {
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

    const missingDraftFields = tables.draftItems
        ? Object.values(DRAFT_FIELDS).filter((fieldName) => {
              return !getFieldOrNull(tables.draftItems, fieldName);
          })
        : [];

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
                    Version 1 is a read-only dashboard scaffold. It confirms that the custom extension can read the POS Backend tables and display active draft items.
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
                missingDraftFields={missingDraftFields}
            />

            <Box className="card">
                <Heading size="medium">(1) Add New Inventory By Design + Product Type</Heading>
                <Text textColor="light">
                    Coming next: Submitted By, Design, Product Type, Production Location, unit price/cost, quantity matrix, and submit button.
                </Text>

                <Box className="placeholder-panel">
                    <Text>
                        This area will become Aud’s inventory loading form after the read-only scaffold is confirmed.
                    </Text>
                </Box>
            </Box>

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
