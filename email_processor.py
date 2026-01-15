"""
Email Processing Module for FinanceTracker

This module handles:
- Parsing incoming emails from forwarded invoices/receipts
- Extracting transaction data (vendor, amount, date)
- Creating pending transactions for user review

Supports email providers:
- SendGrid Inbound Parse
- Mailgun Routes
- Postmark Inbound
- Generic webhook format
"""

import re
import json
import secrets
import hashlib
from datetime import datetime
from email import policy
from email.parser import BytesParser
from typing import Optional, Dict, Any, Tuple

# Common vendor patterns for auto-detection
VENDOR_PATTERNS = {
    # Airlines
    r'ryanair': ('Ryanair', 'Transportation'),
    r'easyjet': ('EasyJet', 'Transportation'),
    r'vueling': ('Vueling', 'Transportation'),
    r'iberia': ('Iberia', 'Transportation'),
    r'lufthansa': ('Lufthansa', 'Transportation'),
    r'air\s*france': ('Air France', 'Transportation'),
    r'klm': ('KLM', 'Transportation'),
    r'british\s*airways': ('British Airways', 'Transportation'),
    r'emirates': ('Emirates', 'Transportation'),
    r'qatar': ('Qatar Airways', 'Transportation'),

    # Hotels
    r'booking\.com': ('Booking.com', 'Housing'),
    r'airbnb': ('Airbnb', 'Housing'),
    r'hotels\.com': ('Hotels.com', 'Housing'),
    r'expedia': ('Expedia', 'Housing'),
    r'marriott': ('Marriott', 'Housing'),
    r'hilton': ('Hilton', 'Housing'),

    # Food & Delivery
    r'uber\s*eats': ('Uber Eats', 'Dining Out'),
    r'deliveroo': ('Deliveroo', 'Dining Out'),
    r'glovo': ('Glovo', 'Dining Out'),
    r'just\s*eat': ('Just Eat', 'Dining Out'),
    r'doordash': ('DoorDash', 'Dining Out'),

    # Transport
    r'uber(?!\s*eats)': ('Uber', 'Transportation'),
    r'bolt': ('Bolt', 'Transportation'),
    r'cabify': ('Cabify', 'Transportation'),
    r'blablacar': ('BlaBlaCar', 'Transportation'),
    r'renfe': ('Renfe', 'Transportation'),
    r'flixbus': ('FlixBus', 'Transportation'),

    # Shopping
    r'amazon': ('Amazon', 'Shopping'),
    r'zalando': ('Zalando', 'Shopping'),
    r'aliexpress': ('AliExpress', 'Shopping'),
    r'ebay': ('eBay', 'Shopping'),
    r'apple\.com|apple\s*store': ('Apple', 'Shopping'),

    # Subscriptions
    r'netflix': ('Netflix', 'Entertainment'),
    r'spotify': ('Spotify', 'Entertainment'),
    r'disney\+|disneyplus': ('Disney+', 'Entertainment'),
    r'hbo\s*max': ('HBO Max', 'Entertainment'),
    r'youtube\s*premium': ('YouTube Premium', 'Entertainment'),
    r'amazon\s*prime': ('Amazon Prime', 'Entertainment'),

    # Utilities
    r'iberdrola': ('Iberdrola', 'Utilities'),
    r'endesa': ('Endesa', 'Utilities'),
    r'naturgy': ('Naturgy', 'Utilities'),
    r'vodafone': ('Vodafone', 'Utilities'),
    r'movistar': ('Movistar', 'Utilities'),
    r'orange': ('Orange', 'Utilities'),

    # Insurance
    r'mapfre': ('Mapfre', 'Healthcare'),
    r'axa': ('AXA', 'Healthcare'),
    r'allianz': ('Allianz', 'Healthcare'),
}

# Currency symbols and codes
CURRENCY_MAP = {
    '€': 'EUR', '£': 'GBP', '$': 'USD', '¥': 'JPY',
    'EUR': 'EUR', 'GBP': 'GBP', 'USD': 'USD', 'JPY': 'JPY',
    'CHF': 'CHF', 'SEK': 'SEK', 'NOK': 'NOK', 'DKK': 'DKK',
    'PLN': 'PLN', 'CZK': 'CZK', 'HUF': 'HUF', 'RON': 'RON',
}


def generate_inbox_email(user_id: int, domain: str = 'in.financetracker.app') -> Tuple[str, str]:
    """
    Generate a unique email address for a user's inbox.

    Returns:
        Tuple of (email_address, token)
    """
    token = secrets.token_urlsafe(16)
    # Create a short hash for the email prefix
    hash_input = f"{user_id}-{token}"
    prefix = hashlib.sha256(hash_input.encode()).hexdigest()[:12]
    email = f"{prefix}@{domain}"
    return email, token


def parse_amount(text: str) -> Optional[Tuple[float, str]]:
    """
    Extract amount and currency from text.

    Args:
        text: Text containing price information

    Returns:
        Tuple of (amount, currency) or None
    """
    # Patterns for different price formats
    patterns = [
        # €123.45 or € 123,45 or EUR 123.45
        r'([€$£¥])\s*([\d.,]+)',
        r'(EUR|USD|GBP|CHF)\s*([\d.,]+)',
        r'([\d.,]+)\s*([€$£¥])',
        r'([\d.,]+)\s*(EUR|USD|GBP|CHF)',
        # Total: 123.45 EUR
        r'total[:\s]*([\d.,]+)\s*(EUR|USD|GBP|€|\$|£)',
        r'amount[:\s]*([\d.,]+)\s*(EUR|USD|GBP|€|\$|£)',
        r'price[:\s]*([\d.,]+)\s*(EUR|USD|GBP|€|\$|£)',
        r'([\d.,]+)\s*(euros?|dollars?|pounds?)',
    ]

    for pattern in patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        if matches:
            for match in matches:
                # Determine which group is the amount
                if match[0] in CURRENCY_MAP or match[0] in '€$£¥':
                    currency_str = match[0]
                    amount_str = match[1]
                else:
                    amount_str = match[0]
                    currency_str = match[1]

                # Parse amount
                amount_str = amount_str.replace(' ', '')
                # Handle European format (1.234,56) vs US format (1,234.56)
                if ',' in amount_str and '.' in amount_str:
                    if amount_str.rfind(',') > amount_str.rfind('.'):
                        amount_str = amount_str.replace('.', '').replace(',', '.')
                    else:
                        amount_str = amount_str.replace(',', '')
                elif ',' in amount_str:
                    # Could be decimal or thousands
                    if re.search(r',\d{2}$', amount_str):
                        amount_str = amount_str.replace(',', '.')
                    else:
                        amount_str = amount_str.replace(',', '')

                try:
                    amount = float(amount_str)
                    if amount > 0:
                        # Normalize currency
                        currency = CURRENCY_MAP.get(currency_str.upper(), 'EUR')
                        if currency_str.lower() in ['euro', 'euros']:
                            currency = 'EUR'
                        elif currency_str.lower() in ['dollar', 'dollars']:
                            currency = 'USD'
                        elif currency_str.lower() in ['pound', 'pounds']:
                            currency = 'GBP'
                        return (amount, currency)
                except ValueError:
                    continue

    return None


def parse_date(text: str) -> Optional[datetime]:
    """
    Extract date from text.

    Args:
        text: Text containing date information

    Returns:
        datetime object or None
    """
    # Common date patterns
    patterns = [
        (r'(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})', '%d/%m/%Y'),  # DD/MM/YYYY
        (r'(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})', '%Y/%m/%d'),  # YYYY/MM/DD
        (r'(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})', '%d %b %Y'),
        (r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})', '%b %d %Y'),
    ]

    for pattern, date_format in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            try:
                date_str = match.group(0).replace(',', '')
                # Normalize separators
                date_str = re.sub(r'[/\-.]', '/', date_str)
                return datetime.strptime(date_str, date_format.replace('/', '/'))
            except ValueError:
                continue

    return None


def detect_vendor(text: str) -> Optional[Tuple[str, str]]:
    """
    Detect vendor/merchant from text.

    Args:
        text: Email text content

    Returns:
        Tuple of (vendor_name, category_name) or None
    """
    text_lower = text.lower()

    for pattern, (vendor, category) in VENDOR_PATTERNS.items():
        if re.search(pattern, text_lower):
            return (vendor, category)

    return None


def parse_email_content(
    subject: str,
    body: str,
    sender: str,
    html_body: str = None
) -> Dict[str, Any]:
    """
    Parse email content to extract transaction information.

    Args:
        subject: Email subject
        body: Plain text body
        sender: Sender email address
        html_body: HTML body (optional)

    Returns:
        Dictionary with parsed transaction data
    """
    result = {
        'vendor': None,
        'amount': None,
        'currency': 'EUR',
        'date': None,
        'description': None,
        'category_suggestion': None,
        'confidence': 0,
    }

    # Combine all text for searching
    all_text = f"{subject} {body} {sender}"
    if html_body:
        # Strip HTML tags for searching
        clean_html = re.sub(r'<[^>]+>', ' ', html_body)
        all_text += f" {clean_html}"

    # Detect vendor
    vendor_info = detect_vendor(all_text)
    if vendor_info:
        result['vendor'] = vendor_info[0]
        result['category_suggestion'] = vendor_info[1]
        result['confidence'] += 30

    # Extract amount
    amount_info = parse_amount(all_text)
    if amount_info:
        result['amount'] = amount_info[0]
        result['currency'] = amount_info[1]
        result['confidence'] += 40

    # Extract date
    parsed_date = parse_date(all_text)
    if parsed_date:
        result['date'] = parsed_date.strftime('%Y-%m-%d')
        result['confidence'] += 20
    else:
        # Default to today
        result['date'] = datetime.now().strftime('%Y-%m-%d')

    # Build description
    if result['vendor']:
        result['description'] = f"Invoice from {result['vendor']}"
    else:
        # Use subject as description
        result['description'] = subject[:200] if subject else "Email receipt"

    # Try to extract from sender if no vendor found
    if not result['vendor'] and sender:
        # Extract domain from sender
        domain_match = re.search(r'@([a-zA-Z0-9.-]+)', sender)
        if domain_match:
            domain = domain_match.group(1).lower()
            # Clean up domain
            domain_parts = domain.split('.')
            if len(domain_parts) > 1:
                result['vendor'] = domain_parts[-2].title()
                result['description'] = f"Receipt from {result['vendor']}"
                result['confidence'] += 10

    return result


def parse_raw_email(raw_email: bytes) -> Dict[str, Any]:
    """
    Parse a raw email (RFC 2822 format).

    Args:
        raw_email: Raw email bytes

    Returns:
        Dictionary with email data and parsed transaction info
    """
    parser = BytesParser(policy=policy.default)
    msg = parser.parsebytes(raw_email)

    # Extract basic info
    subject = msg['subject'] or ''
    sender = msg['from'] or ''
    date = msg['date']

    # Get body
    body = ''
    html_body = ''

    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            if content_type == 'text/plain':
                body = part.get_content()
            elif content_type == 'text/html':
                html_body = part.get_content()
    else:
        content_type = msg.get_content_type()
        if content_type == 'text/plain':
            body = msg.get_content()
        elif content_type == 'text/html':
            html_body = msg.get_content()

    # Extract attachments info
    attachments = []
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_disposition() == 'attachment':
                attachments.append({
                    'filename': part.get_filename(),
                    'content_type': part.get_content_type(),
                    'size': len(part.get_content()),
                })

    # Parse transaction data
    parsed = parse_email_content(subject, body, sender, html_body)

    return {
        'subject': subject,
        'sender': sender,
        'date': date,
        'body': body,
        'html_body': html_body,
        'attachments': attachments,
        'parsed': parsed,
    }


def process_sendgrid_webhook(data: Dict) -> Dict[str, Any]:
    """
    Process SendGrid Inbound Parse webhook data.

    Args:
        data: SendGrid webhook payload

    Returns:
        Normalized email data
    """
    return {
        'sender': data.get('from', ''),
        'to': data.get('to', ''),
        'subject': data.get('subject', ''),
        'body': data.get('text', ''),
        'html_body': data.get('html', ''),
        'attachments': json.loads(data.get('attachment-info', '{}')) if data.get('attachment-info') else {},
        'raw': data,
    }


def process_mailgun_webhook(data: Dict) -> Dict[str, Any]:
    """
    Process Mailgun webhook data.

    Args:
        data: Mailgun webhook payload

    Returns:
        Normalized email data
    """
    return {
        'sender': data.get('sender', ''),
        'to': data.get('recipient', ''),
        'subject': data.get('subject', ''),
        'body': data.get('body-plain', ''),
        'html_body': data.get('body-html', ''),
        'attachments': {},
        'raw': data,
    }


def process_postmark_webhook(data: Dict) -> Dict[str, Any]:
    """
    Process Postmark Inbound webhook data.

    Args:
        data: Postmark webhook payload

    Returns:
        Normalized email data
    """
    return {
        'sender': data.get('From', ''),
        'to': data.get('To', ''),
        'subject': data.get('Subject', ''),
        'body': data.get('TextBody', ''),
        'html_body': data.get('HtmlBody', ''),
        'attachments': data.get('Attachments', []),
        'raw': data,
    }
