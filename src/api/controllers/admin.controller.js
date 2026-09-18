const adminService = require('../../services/admin.service');

function evaluateFormula(expr) {
    if (typeof expr === 'number') {
        if (!isFinite(expr)) throw new Error('Invalid number');
        return expr;
    }
    if (typeof expr !== 'string' || !expr.trim()) {
        throw new Error('Invalid formula');
    }
    if (!/^[0-9+\-*/().\s%]+$/.test(expr)) {
        throw new Error('Invalid formula characters');
    }

    const tokens = expr.match(/(?:\d+(?:\.\d*)?|\.\d+)|[+\-*/%()]/g);
    if (!tokens) throw new Error('No tokens');

    if (tokens.join('') !== expr.replace(/\s+/g, '')) {
        throw new Error('Invalid characters in expression');
    }

    let pos = 0;

    function parseExpression() {
        let val = parseTerm();
        while (pos < tokens.length && (tokens[pos] === '+' || tokens[pos] === '-')) {
            const op = tokens[pos++];
            const next = parseTerm();
            val = op === '+' ? val + next : val - next;
        }
        return val;
    }

    function parseTerm() {
        let val = parseFactor();
        while (pos < tokens.length && (tokens[pos] === '*' || tokens[pos] === '/' || tokens[pos] === '%')) {
            const op = tokens[pos++];
            const next = parseFactor();
            if (op === '*') val = val * next;
            else if (op === '/') val = val / next;
            else val = val % next;
        }
        return val;
    }

    function parseFactor() {
        if (pos >= tokens.length) throw new Error('Unexpected end of expression');
        if (tokens[pos] === '+') {
            pos++;
            return parseFactor();
        }
        if (tokens[pos] === '-') {
            pos++;
            return -parseFactor();
        }
        if (tokens[pos] === '(') {
            pos++;
            const val = parseExpression();
            if (pos >= tokens.length || tokens[pos] !== ')') {
                throw new Error('Mismatched parentheses');
            }
            pos++;
            return val;
        }
        const num = parseFloat(tokens[pos]);
        if (isNaN(num)) throw new Error('Expected number');
        pos++;
        return num;
    }

    const result = parseExpression();
    if (pos < tokens.length) {
        throw new Error('Unexpected token after expression: ' + tokens[pos]);
    }
    if (!isFinite(result)) {
        throw new Error('Non-finite result');
    }
    return result;
}

exports.checkShippingStatus = (req, res) => {
    adminService.pingProvider(req.body.providerIP, req.body.options, out => res.send(out));
};

exports.previewDynamicPricing = (req, res) => {
    try {
        if (!req.body || req.body.formula === undefined) {
            return res.status(400).send("Evaluation Failed");
        }
        res.json({ price: evaluateFormula(req.body.formula) });
    } catch (e) {
        res.status(400).send("Evaluation Failed");
    }
};
