/**
 * Universal UiPath Workflow to Playwright Migration Parser
 * 
 * Supports:
 * - Real UiPath .xaml XML files & Studio activity logs
 * - Any Web Framework / Tool (React, Angular, Vue, Next.js, Salesforce, SAP, Generic HTML5)
 * - UiPath Selector XML fragments (<webctrl tag='...' />)
 * - Structured JSON test cases & manual action steps
 */

export function parseUiPathInput(input, options = {}) {
  const trimmed = (input || '').trim();

  // 1. If JSON input, parse directly
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      return normalizeJsonTestCase(parsed, options);
    } catch {
      // Fall through to text/XML parsing
    }
  }

  // 2. If UiPath XAML / XML
  if (trimmed.includes('<Activity') || trimmed.includes('<Sequence') || trimmed.includes('<ui:') || trimmed.includes('<webctrl')) {
    return parseUiPathXaml(trimmed, options);
  }

  // 3. Fallback to Plaintext / Step-by-Step Activity Log
  return parsePlaintextWorkflow(trimmed, options);
}

/**
 * Extracts attributes from UiPath <webctrl ... /> or <ui:Target Selector="..." />
 */
export function parseUiPathSelector(selectorStr) {
  if (!selectorStr) return {};

  const clean = selectorStr
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');

  const attrs = {};

  const tagMatch = clean.match(/tag=['"]([^'"]+)['"]/i);
  if (tagMatch) attrs.tag = tagMatch[1].toLowerCase();

  const classMatch = clean.match(/(?:class|parentclass)=['"]([^'"]+)['"]/i);
  if (classMatch) attrs.class = classMatch[1];

  const textMatch = clean.match(/(?:innertext|aaname|text|title)=['"]([^'"]+)['"]/i);
  if (textMatch) attrs.text = textMatch[1].trim();

  const idMatch = clean.match(/id=['"]([^'"]+)['"]/i);
  if (idMatch) attrs.id = idMatch[1];

  const nameMatch = clean.match(/name=['"]([^'"]+)['"]/i);
  if (nameMatch) attrs.name = nameMatch[1];

  const typeMatch = clean.match(/type=['"]([^'"]+)['"]/i);
  if (typeMatch) attrs.type = typeMatch[1].toLowerCase();

  const placeholderMatch = clean.match(/placeholder=['"]([^'"]+)['"]/i);
  if (placeholderMatch) attrs.placeholder = placeholderMatch[1];

  const ariaLabelMatch = clean.match(/(?:aria-label|aria_label)=['"]([^'"]+)['"]/i);
  if (ariaLabelMatch) attrs.ariaLabel = ariaLabelMatch[1];

  const testIdMatch = clean.match(/(?:data-testid|data-test|data-cy|data-qa)=['"]([^'"]+)['"]/i);
  if (testIdMatch) attrs.testId = testIdMatch[1];

  const xpathMatch = clean.match(/xpath=['"]([^'"]+)['"]/i);
  if (xpathMatch) attrs.xpath = xpathMatch[1];

  const hrefMatch = clean.match(/href=['"]([^'"]+)['"]/i);
  if (hrefMatch) attrs.href = hrefMatch[1];

  return attrs;
}

/**
 * Maps UiPath selector attributes to clean Playwright semantic locators
 * Works across ANY web application framework (React, Angular, Vue, Portals, HTML5)
 */
export function mapToPlaywrightLocator(attrs) {
  const { tag, class: className, text, id, name, type, placeholder, ariaLabel, testId, xpath } = attrs;

  // 1. Prioritize Test IDs (data-testid, data-cy, data-test)
  if (testId) {
    return {
      expression: `page.getByTestId('${testId}')`,
      component: `[data-testid="${testId}"]`,
      strategy: 'TEST_ID'
    };
  }

  // 2. Aria-Label / Accessible Name
  if (ariaLabel) {
    if (tag === 'button') {
      return {
        expression: `page.getByRole('button', { name: '${ariaLabel}' })`,
        component: `Button (${ariaLabel})`,
        strategy: 'ARIA_BUTTON'
      };
    }
    return {
      expression: `page.getByLabel('${ariaLabel}')`,
      component: `[aria-label="${ariaLabel}"]`,
      strategy: 'ARIA_LABEL'
    };
  }

  // 3. Form Input Placeholders
  if (placeholder) {
    return {
      expression: `page.getByPlaceholder('${placeholder}')`,
      component: `Input (${placeholder})`,
      strategy: 'PLACEHOLDER'
    };
  }

  // 4. Semantic Links & Buttons
  if (tag === 'a' && text) {
    if (className) {
      const rootClass = className.split(/\s+/)[0];
      const cleanRoot = rootClass.includes('__') ? rootClass.split('__')[0] : rootClass;
      return {
        expression: `page.locator('.${cleanRoot}').getByRole('link', { name: /${escapeRegex(text)}/i }).first()`,
        component: `.${cleanRoot} Link`,
        strategy: 'SCOPED_ROLE_LINK'
      };
    }
    return {
      expression: `page.getByRole('link', { name: '${text}', exact: true })`,
      component: 'Link',
      strategy: 'ARIA_LINK'
    };
  }

  if ((tag === 'button' || (tag === 'input' && (type === 'submit' || type === 'button'))) && (text || name)) {
    const btnLabel = text || name;
    if (className) {
      const rootClass = className.split(/\s+/)[0];
      const cleanRoot = rootClass.includes('__') ? rootClass.split('__')[0] : rootClass;
      return {
        expression: `page.locator('.${cleanRoot}').getByRole('button', { name: /${escapeRegex(btnLabel)}/i }).first()`,
        component: `.${cleanRoot} Button`,
        strategy: 'SCOPED_ROLE_BUTTON'
      };
    }
    return {
      expression: `page.getByRole('button', { name: '${btnLabel}' })`,
      component: 'Button',
      strategy: 'ARIA_BUTTON'
    };
  }

  // 5. Textboxes, Inputs & Checkboxes
  if (tag === 'input') {
    if (type === 'checkbox') {
      return {
        expression: text ? `page.getByRole('checkbox', { name: '${text}' })` : `page.locator('input[type="checkbox"]').first()`,
        component: 'Checkbox',
        strategy: 'ARIA_CHECKBOX'
      };
    }
    if (type === 'radio') {
      return {
        expression: text ? `page.getByRole('radio', { name: '${text}' })` : `page.locator('input[type="radio"]').first()`,
        component: 'Radio',
        strategy: 'ARIA_RADIO'
      };
    }
    if (type === 'search' || (className && className.includes('search'))) {
      return {
        expression: `page.locator('input[type="search"], .search-input, .cmp-search__input').first()`,
        component: 'Search Input',
        strategy: 'SEARCH_INPUT'
      };
    }
    if (name) {
      return {
        expression: `page.locator('input[name="${name}"]')`,
        component: `Input [name="${name}"]`,
        strategy: 'NAME_SELECTOR'
      };
    }
    if (text) {
      return {
        expression: `page.getByRole('textbox', { name: '${text}' })`,
        component: 'Textbox',
        strategy: 'ARIA_TEXTBOX'
      };
    }
  }

  // 6. Select / Dropdowns
  if (tag === 'select') {
    if (name) {
      return {
        expression: `page.locator('select[name="${name}"]')`,
        component: `Select [name="${name}"]`,
        strategy: 'SELECT_NAME'
      };
    }
    return {
      expression: `page.getByRole('combobox')`,
      component: 'Dropdown / Select',
      strategy: 'ARIA_COMBOBOX'
    };
  }

  // 7. Structured BEM / Framework Classes
  if (className) {
    const primaryClass = className.split(/\s+/)[0];
    const rootBlock = primaryClass.includes('__') ? primaryClass.split('__')[0] : primaryClass;

    if (text) {
      return {
        expression: `page.locator('.${primaryClass}').filter({ hasText: /${escapeRegex(text)}/i }).first()`,
        component: `.${primaryClass}`,
        strategy: 'SCOPED_TEXT_FILTER'
      };
    }
    return {
      expression: `page.locator('.${primaryClass}').first()`,
      component: `.${primaryClass}`,
      strategy: 'CLASS_LOCATOR'
    };
  }

  // 8. Element ID
  if (id) {
    return {
      expression: `page.locator('#${id}')`,
      component: `#${id}`,
      strategy: 'ID_SELECTOR'
    };
  }

  // 9. Semantic Text fallback
  if (text) {
    return {
      expression: `page.getByText('${text}', { exact: false })`,
      component: `Text (${text})`,
      strategy: 'ACCESSIBLE_TEXT'
    };
  }

  return {
    expression: `page.locator('body')`,
    component: 'Root',
    strategy: 'FALLBACK'
  };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parses full UiPath .xaml XML content
 */
function parseUiPathXaml(xamlText, options = {}) {
  const steps = [];
  let stepCounter = 1;
  let targetUrl = options.targetUrl || '/';
  const testName = options.testName || 'Migrated UiPath Web Journey';

  // 1. Detect OpenBrowser or NavigateTo
  const browserMatch = xamlText.match(/<ui:(?:OpenBrowser|NavigateTo)[^>]*Url=['"]([^'"]+)['"]/i);
  if (browserMatch) {
    targetUrl = browserMatch[1];
    steps.push({
      stepNumber: stepCounter++,
      action: 'Navigate to Target Web Page',
      type: 'navigate',
      url: targetUrl,
      locator: 'page.goto(targetUrl)',
      rawUiPath: browserMatch[0]
    });
  } else {
    steps.push({
      stepNumber: stepCounter++,
      action: 'Navigate to Application URL',
      type: 'navigate',
      url: targetUrl,
      locator: 'page.goto(targetUrl)',
      rawUiPath: 'Initial Page Load'
    });
  }

  // 2. Extract Clicks, TypeIntos, Checks, SelectItems, Validations
  const activityRegex = /<ui:(Click|TypeInto|Check|SelectItem|GetValue|Hover)[^>]*>([\s\S]*?)<\/ui:\1>/gi;
  let match;

  while ((match = activityRegex.exec(xamlText)) !== null) {
    const actType = match[1];
    const actContent = match[2];

    const selMatch = actContent.match(/Selector=['"]([^'"]+)['"]/i) || actContent.match(/<webctrl[^>]+>/i);
    const rawSelector = selMatch ? (selMatch[1] || selMatch[0]) : '';
    const attrs = parseUiPathSelector(rawSelector);
    const mapping = mapToPlaywrightLocator(attrs);

    if (actType === 'Click') {
      const label = attrs.text || attrs.ariaLabel || attrs.testId || attrs.class || 'Button/Link';
      steps.push({
        stepNumber: stepCounter++,
        action: `Click on ${label}`,
        type: 'click',
        targetComponent: mapping.component,
        locator: mapping.expression,
        rawSelector,
        strategy: mapping.strategy
      });
    } else if (actType === 'TypeInto') {
      const textMatch = actContent.match(/Text=['"]([^'"]+)['"]/i) || match[0].match(/Text=['"]([^'"]+)['"]/i);
      const textVal = textMatch ? textMatch[1].replace(/\[k\(enter\)\]/gi, '').trim() : 'Search Term';
      steps.push({
        stepNumber: stepCounter++,
        action: `Fill '${textVal}' into ${attrs.name || attrs.placeholder || attrs.class || 'input'}`,
        type: 'type',
        textValue: textVal,
        targetComponent: mapping.component,
        locator: mapping.expression,
        rawSelector,
        strategy: mapping.strategy
      });
    } else if (actType === 'Check') {
      steps.push({
        stepNumber: stepCounter++,
        action: `Check option / checkbox`,
        type: 'check',
        targetComponent: mapping.component,
        locator: mapping.expression,
        rawSelector,
        strategy: mapping.strategy
      });
    } else if (actType === 'SelectItem') {
      const itemMatch = actContent.match(/Item=['"]([^'"]+)['"]/i);
      const itemVal = itemMatch ? itemMatch[1] : '';
      steps.push({
        stepNumber: stepCounter++,
        action: `Select '${itemVal}' from dropdown`,
        type: 'select',
        textValue: itemVal,
        targetComponent: mapping.component,
        locator: mapping.expression,
        rawSelector,
        strategy: mapping.strategy
      });
    }
  }

  // 3. Fallback for self-closing activity tags
  if (steps.length <= 1) {
    const selfClosingRegex = /<ui:(Click|TypeInto|Check|SelectItem)([^>]*?)(?:\/>|>[\s\S]*?<\/ui:\1>)/gi;
    let scMatch;
    while ((scMatch = selfClosingRegex.exec(xamlText)) !== null) {
      const actType = scMatch[1];
      const block = scMatch[2] + (scMatch[0] || '');

      let rawSel = '';
      const webctrlM = block.match(/<webctrl[^>]+>/i);
      if (webctrlM) {
        rawSel = webctrlM[0];
      } else {
        const selM = block.match(/Selector=(["][^"]+["]|['][^']+['])/i);
        rawSel = selM ? selM[1].slice(1, -1) : '';
      }

      const attrs = parseUiPathSelector(rawSel);
      const mapping = mapToPlaywrightLocator(attrs);

      steps.push({
        stepNumber: stepCounter++,
        action: `${actType} on ${attrs.text || attrs.ariaLabel || attrs.testId || attrs.class || attrs.tag || 'Element'}`,
        type: actType.toLowerCase(),
        targetComponent: mapping.component,
        locator: mapping.expression,
        rawSelector: rawSel,
        strategy: mapping.strategy
      });
    }
  }

  return {
    testName,
    legacySource: options.filename || 'UiPath_Workflow.xaml',
    targetUrl,
    steps,
    assertions: [
      { component: 'body', condition: 'toBeVisible', description: 'Application layout renders successfully' }
    ]
  };
}

/**
 * Parses freeform plaintext logs, activity lists, or step bullet points
 */
function parsePlaintextWorkflow(text, options = {}) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const steps = [];
  let stepCounter = 1;
  let targetUrl = options.targetUrl || '/';
  const testName = options.testName || 'Generic Web Automation Journey';

  steps.push({
    stepNumber: stepCounter++,
    action: 'Navigate to Target Web Page',
    type: 'navigate',
    url: targetUrl,
    locator: 'page.goto(targetUrl)'
  });

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('navigate') || lower.includes('open browser') || lower.includes('url')) {
      const urlMatch = line.match(/https?:\/\/[^\s'"]+/i);
      if (urlMatch) targetUrl = urlMatch[0];
    } else if (lower.includes('click')) {
      const quoteMatch = line.match(/['"]([^'"]+)['"]/);
      const targetText = quoteMatch ? quoteMatch[1] : line.replace(/click\s*(on)?/i, '').trim();
      const attrs = parseUiPathSelector(line);
      if (targetText && !attrs.text) attrs.text = targetText;
      const mapping = mapToPlaywrightLocator(attrs);

      steps.push({
        stepNumber: stepCounter++,
        action: `Click '${targetText || 'element'}'`,
        type: 'click',
        targetComponent: mapping.component,
        locator: mapping.expression,
        rawSelector: line,
        strategy: mapping.strategy
      });
    } else if (lower.includes('type') || lower.includes('fill') || lower.includes('search')) {
      const quoteMatch = line.match(/['"]([^'"]+)['"]/);
      const val = quoteMatch ? quoteMatch[1] : 'Input Value';
      const attrs = parseUiPathSelector(line);
      const mapping = mapToPlaywrightLocator({ ...attrs, tag: 'input' });

      steps.push({
        stepNumber: stepCounter++,
        action: `Fill '${val}' into input field`,
        type: 'type',
        textValue: val,
        targetComponent: mapping.component,
        locator: mapping.expression,
        rawSelector: line,
        strategy: mapping.strategy
      });
    }
  }

  // Defaults if input was minimal
  if (steps.length <= 1) {
    steps.push({
      stepNumber: stepCounter++,
      action: "Click navigation item or CTA link",
      type: 'click',
      targetComponent: 'Navigation Link',
      locator: "page.getByRole('link').first()",
      strategy: 'ARIA_LINK'
    });
    steps.push({
      stepNumber: stepCounter++,
      action: "Validate action button is interactive",
      type: 'click',
      targetComponent: 'Action Button',
      locator: "page.getByRole('button').first()",
      strategy: 'ARIA_BUTTON'
    });
  }

  return {
    testName,
    legacySource: options.filename || 'Pasted_UiPath_Workflow',
    targetUrl,
    steps,
    assertions: [
      { component: 'body', condition: 'toBeVisible', description: 'Web application renders successfully' }
    ]
  };
}

/**
 * Normalizes standard JSON test case definitions
 */
function normalizeJsonTestCase(data, options = {}) {
  return {
    testName: data.testName || data.summary || options.testName || 'Web Journey Test',
    ticketId: data.ticketId || options.ticketId || null,
    legacySource: data.legacyWorkflow || options.filename || 'UiPath_Definition.json',
    targetUrl: data.targetUrl || options.targetUrl || '/',
    steps: data.testSteps || data.steps || [],
    assertions: data.assertions || []
  };
}
