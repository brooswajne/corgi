const JSZip = require('jszip');

const { isObject } = require('../../lib/common');
const {
    // cellOrdering,
    columnOrdering,
    columnToNumber,
    iterateColumns,
    iterateRows,
    numberToColumn,
    parseCellReference,
    rowOrdering,
} = require('../../lib/excel');

module.exports = function constructWorkbook(...worksheetSpecs) {
    const workbook = new JSZip();

    let totalSharedStringUses = 0;
    const sharedStrings = [];
    for (let worksheetIdx = 1; worksheetIdx <= worksheetSpecs.length; worksheetIdx++) {
        const worksheetName = `xl/worksheets/sheet${worksheetIdx}.xml`;

        let worksheetData = worksheetSpecs[worksheetIdx - 1];
        if (Array.isArray(worksheetData)) {
            worksheetData = worksheetData.reduce((dataObject, row, rowIdx) => {
                return row.reduce((dataObject, cell, columnIdx) => {
                    if (cell === null) return dataObject; // empty cell
                    const cellRef = `${numberToColumn(columnIdx + 1)}${rowIdx + 1}`;
                    dataObject[cellRef] = cell;
                    return dataObject;
                }, dataObject);
            }, {});
        }
        if (!isObject(worksheetData)) throw new Error('Invalid format for excel worksheet data');

        const cells = Object.keys(worksheetData)
            .map(parseCellReference);
        const rows = cells.map(c => c.row)
            .sort(rowOrdering);

        const cellXML = [];
        for (const row of iterateRows(rows[0], rows[rows.length - 1])) {
            const cols = cells.filter(c => c.row === row)
                .map(c => c.col)
                .sort(columnOrdering);
            cellXML.push(`<row r="${row}" spans="${columnToNumber(cols[0])}:${columnToNumber(cols[1])}">`);
            for (const col of iterateColumns(cols[0], cols[cols.length - 1])) {
                const cellRef = `${col}${row}`;
                if (!(cellRef in worksheetData)) continue;

                const contents = worksheetData[cellRef];
                let sharedStringIdx = sharedStrings.indexOf(contents);
                if (sharedStringIdx === -1) sharedStringIdx = sharedStrings.push(contents) - 1;
                totalSharedStringUses += 1;

                cellXML.push(`<c r="${col}${row}" t="s"><v>${sharedStringIdx}</v></c>`);
            }
            cellXML.push('</row>');
        }

        // const allCells = Object.keys(worksheetData)
        //     .sort(cellOrdering);
        const allRows = cells.map(c => c.row)
            .sort((a, b) => a - b);
        const allColumns = cells.map(c => c.col)
            .sort(columnOrdering);
        const worksheetXML = [
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n',
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
                + ' xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x14ac xr xr2 xr3"'
                + ' xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac" xmlns:xr="http://schemas.microsoft.com/office/spreadsheetml/2014/revision"'
                + ' xmlns:xr2="http://schemas.microsoft.com/office/spreadsheetml/2015/revision2" xmlns:xr3="http://schemas.microsoft.com/office/spreadsheetml/2016/revision3"'
                + ' xr:uid="{93522021-26F2-4A00-AFF9-FB6331673228}">',
            `<dimension ref="${allColumns[0]}${allRows[0]}:${allColumns[allColumns.length - 1]}${allRows[allRows.length - 1]}" />`,

            '<cols>',
            `<col min="${columnToNumber(allColumns[0])}" max="${columnToNumber(allColumns[allColumns.length - 1])}" width="15.578125" />`,
            '</cols>',

            '<sheetData>',
            ...cellXML,
            '</sheetData>',

            '</worksheet>',
        ];

        workbook.file(worksheetName, worksheetXML.join(''));
    }

    workbook.file('xl/sharedStrings.xml', [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n',
        '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
            + ` count="${totalSharedStringUses}"`
            + ` uniqueCount="${sharedStrings.length}">`,
        ...sharedStrings.map(s => `<si><t>${s}</t></si>`),
        '</sst>',
    ].join(''));

    workbook.file('xl/workbook.xml', [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n',
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
            + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
            + ' xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x15 xr xr6 xr10 xr2"'
            + ' xmlns:x15="http://schemas.microsoft.com/office/spreadsheetml/2010/11/main"'
            + ' xmlns:xr="http://schemas.microsoft.com/office/spreadsheetml/2014/revision"'
            + ' xmlns:xr6="http://schemas.microsoft.com/office/spreadsheetml/2016/revision6"'
            + ' xmlns:xr10="http://schemas.microsoft.com/office/spreadsheetml/2016/revision10"'
            + ' xmlns:xr2="http://schemas.microsoft.com/office/spreadsheetml/2015/revision2">',
        '<fileVersion appName="xl" lastEdited="1" lowestEdited="1" rupBuild="21126" />',
        '<workbookPr defaultThemeVersion="166925" />',
        '<sheets>',
        ...worksheetSpecs.map((s, idx) => `<sheet name="Sheet${idx+1}" sheetId="${idx+1}" r:id="rId${idx+4}" />`),
        '</sheets>',
        '</workbook>',
    ].join(''));

    workbook.file('xl/_rels/workbook.xml.rels', [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n',
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>',
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>',
        ...worksheetSpecs.map((s, idx) => `<Relationship Id="rId${idx+4}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${idx+1}.xml"/>`),
        '</Relationships>',
    ].join(''));

    workbook.file('docProps/app.xml', [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n',
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"'
            + ' xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">',
        '<Application>Microsoft Excel</Application>',
        '<DocSecurity>0</DocSecurity>',
        '<ScaleCrop>false</ScaleCrop>',
        '<HeadingPairs>',
        '<vt:vector size="2" baseType="variant">',
        '<vt:variant>',
        '<vt:lpstr>Worksheets</vt:lpstr>',
        '</vt:variant>',
        '<vt:variant>',
        `<vt:i4>${worksheetSpecs.length}</vt:i4>`,
        '</vt:variant>',
        '</vt:vector>',
        '</HeadingPairs>',
        '<TitlesOfParts>',
        `<vt:vector size="${worksheetSpecs.length}" baseType="lpstr">`,
        ...worksheetSpecs.map((s, idx) => `<vt:lpstr>Sheet${idx+1}</vt:lpstr>`),
        '</vt:vector>',
        '</TitlesOfParts>',
        '<Company></Company>',
        '<LinksUpToDate>false</LinksUpToDate>',
        '<SharedDoc>false</SharedDoc>',
        '<HyperlinksChanged>false</HyperlinksChanged>',
        '<AppVersion>16.0300</AppVersion>',
        '</Properties>',
    ].join(''));

    workbook.file('[Content_Types].xml', [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n',
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
        '<Default Extension="bin" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.printerSettings"/>',
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
        '<Default Extension="xml" ContentType="application/xml"/>',
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
        ...worksheetSpecs.map((s, idx) => `<Override PartName="/xl/worksheets/sheet${idx+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`),
        '<Override PartName="/xl/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>',
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
        '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>',
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>',
    ].join(''));

    workbook.file('docProps/core.xml', PROPS);
    workbook.file('xl/theme/theme1.xml', THEME);
    workbook.file('_rels/.rels', RELS);

    return workbook.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
};

const THEME = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme"><a:themeElements><a:clrScheme name="Office"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2><a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2><a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4><a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Office"><a:majorFont><a:latin typeface="Calibri Light" panose="020F0302020204030204"/><a:ea typeface=""/><a:cs typeface=""/><a:font script="Jpan" typeface="游ゴシック Light"/><a:font script="Hang" typeface="맑은 고딕"/><a:font script="Hans" typeface="等线 Light"/><a:font script="Hant" typeface="新細明體"/><a:font script="Arab" typeface="Times New Roman"/><a:font script="Hebr" typeface="Times New Roman"/><a:font script="Thai" typeface="Tahoma"/><a:font script="Ethi" typeface="Nyala"/><a:font script="Beng" typeface="Vrinda"/><a:font script="Gujr" typeface="Shruti"/><a:font script="Khmr" typeface="MoolBoran"/><a:font script="Knda" typeface="Tunga"/><a:font script="Guru" typeface="Raavi"/><a:font script="Cans" typeface="Euphemia"/><a:font script="Cher" typeface="Plantagenet Cherokee"/><a:font script="Yiii" typeface="Microsoft Yi Baiti"/><a:font script="Tibt" typeface="Microsoft Himalaya"/><a:font script="Thaa" typeface="MV Boli"/><a:font script="Deva" typeface="Mangal"/><a:font script="Telu" typeface="Gautami"/><a:font script="Taml" typeface="Latha"/><a:font script="Syrc" typeface="Estrangelo Edessa"/><a:font script="Orya" typeface="Kalinga"/><a:font script="Mlym" typeface="Kartika"/><a:font script="Laoo" typeface="DokChampa"/><a:font script="Sinh" typeface="Iskoola Pota"/><a:font script="Mong" typeface="Mongolian Baiti"/><a:font script="Viet" typeface="Times New Roman"/><a:font script="Uigh" typeface="Microsoft Uighur"/><a:font script="Geor" typeface="Sylfaen"/><a:font script="Armn" typeface="Arial"/><a:font script="Bugi" typeface="Leelawadee UI"/><a:font script="Bopo" typeface="Microsoft JhengHei"/><a:font script="Java" typeface="Javanese Text"/><a:font script="Lisu" typeface="Segoe UI"/><a:font script="Mymr" typeface="Myanmar Text"/><a:font script="Nkoo" typeface="Ebrima"/><a:font script="Olck" typeface="Nirmala UI"/><a:font script="Osma" typeface="Ebrima"/><a:font script="Phag" typeface="Phagspa"/><a:font script="Syrn" typeface="Estrangelo Edessa"/><a:font script="Syrj" typeface="Estrangelo Edessa"/><a:font script="Syre" typeface="Estrangelo Edessa"/><a:font script="Sora" typeface="Nirmala UI"/><a:font script="Tale" typeface="Microsoft Tai Le"/><a:font script="Talu" typeface="Microsoft New Tai Lue"/><a:font script="Tfng" typeface="Ebrima"/></a:majorFont><a:minorFont><a:latin typeface="Calibri" panose="020F0502020204030204"/><a:ea typeface=""/><a:cs typeface=""/><a:font script="Jpan" typeface="游ゴシック"/><a:font script="Hang" typeface="맑은 고딕"/><a:font script="Hans" typeface="等线"/><a:font script="Hant" typeface="新細明體"/><a:font script="Arab" typeface="Arial"/><a:font script="Hebr" typeface="Arial"/><a:font script="Thai" typeface="Tahoma"/><a:font script="Ethi" typeface="Nyala"/><a:font script="Beng" typeface="Vrinda"/><a:font script="Gujr" typeface="Shruti"/><a:font script="Khmr" typeface="DaunPenh"/><a:font script="Knda" typeface="Tunga"/><a:font script="Guru" typeface="Raavi"/><a:font script="Cans" typeface="Euphemia"/><a:font script="Cher" typeface="Plantagenet Cherokee"/><a:font script="Yiii" typeface="Microsoft Yi Baiti"/><a:font script="Tibt" typeface="Microsoft Himalaya"/><a:font script="Thaa" typeface="MV Boli"/><a:font script="Deva" typeface="Mangal"/><a:font script="Telu" typeface="Gautami"/><a:font script="Taml" typeface="Latha"/><a:font script="Syrc" typeface="Estrangelo Edessa"/><a:font script="Orya" typeface="Kalinga"/><a:font script="Mlym" typeface="Kartika"/><a:font script="Laoo" typeface="DokChampa"/><a:font script="Sinh" typeface="Iskoola Pota"/><a:font script="Mong" typeface="Mongolian Baiti"/><a:font script="Viet" typeface="Arial"/><a:font script="Uigh" typeface="Microsoft Uighur"/><a:font script="Geor" typeface="Sylfaen"/><a:font script="Armn" typeface="Arial"/><a:font script="Bugi" typeface="Leelawadee UI"/><a:font script="Bopo" typeface="Microsoft JhengHei"/><a:font script="Java" typeface="Javanese Text"/><a:font script="Lisu" typeface="Segoe UI"/><a:font script="Mymr" typeface="Myanmar Text"/><a:font script="Nkoo" typeface="Ebrima"/><a:font script="Olck" typeface="Nirmala UI"/><a:font script="Osma" typeface="Ebrima"/><a:font script="Phag" typeface="Phagspa"/><a:font script="Syrn" typeface="Estrangelo Edessa"/><a:font script="Syrj" typeface="Estrangelo Edessa"/><a:font script="Syre" typeface="Estrangelo Edessa"/><a:font script="Sora" typeface="Nirmala UI"/><a:font script="Tale" typeface="Microsoft Tai Le"/><a:font script="Talu" typeface="Microsoft New Tai Lue"/><a:font script="Tfng" typeface="Ebrima"/></a:minorFont></a:fontScheme><a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:lumMod val="110000"/><a:satMod val="105000"/><a:tint val="67000"/></a:schemeClr></a:gs><a:gs pos="50000"><a:schemeClr val="phClr"><a:lumMod val="105000"/><a:satMod val="103000"/><a:tint val="73000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:lumMod val="105000"/><a:satMod val="109000"/><a:tint val="81000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:satMod val="103000"/><a:lumMod val="102000"/><a:tint val="94000"/></a:schemeClr></a:gs><a:gs pos="50000"><a:schemeClr val="phClr"><a:satMod val="110000"/><a:lumMod val="100000"/><a:shade val="100000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:lumMod val="99000"/><a:satMod val="120000"/><a:shade val="78000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln><a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln><a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst><a:outerShdw blurRad="57150" dist="19050" dir="5400000" algn="ctr" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="63000"/></a:srgbClr></a:outerShdw></a:effectLst></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"><a:tint val="95000"/><a:satMod val="170000"/></a:schemeClr></a:solidFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="93000"/><a:satMod val="150000"/><a:shade val="98000"/><a:lumMod val="102000"/></a:schemeClr></a:gs><a:gs pos="50000"><a:schemeClr val="phClr"><a:tint val="98000"/><a:satMod val="130000"/><a:shade val="90000"/><a:lumMod val="103000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="63000"/><a:satMod val="120000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/><a:extLst><a:ext uri="{05A4C25C-085E-4340-85A3-A5531E510DB2}"><thm15:themeFamily xmlns:thm15="http://schemas.microsoft.com/office/thememl/2012/main" name="Office Theme" id="{62F939B6-93AF-4DB8-9C6B-D6C7DFDC589F}" vid="{4A3C46E8-61CC-4603-A589-7422A47A8E4A}"/></a:ext></a:extLst></a:theme>`;
const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
const PROPS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>Joe Bloggs</dc:creator><cp:lastModifiedBy>Jane Bloggs</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">2018-12-14T11:31:14Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">2018-12-17T15:05:38Z</dcterms:modified></cp:coreProperties>`;
