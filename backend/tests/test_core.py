import pytest
from datetime import datetime, date, timezone
from app.core import encode, decode, clean_values, valid_id, starter_groups
from fastapi import HTTPException

def test_encode_types():
    assert encode(None)['type'] == 'Null'
    assert encode(True)['type'] == 'Boolean'
    assert encode(5)['type'] == 'Integer'
    assert encode(2 ** 40)['type'] == 'Long'
    assert encode(1.5)['type'] == 'Double'
    assert encode(date(2026, 11, 10))['value'] == '2026-11-10'
    assert encode({'a': 1})['type'] == 'Json'
    assert encode(datetime.now(timezone.utc))['type'] == 'Date'
    with pytest.raises(ValueError):
        encode(datetime.now())

def test_decode():
    assert decode({'type': 'Json', 'value': '{"a":1}'}) == {'a': 1}
    assert decode({'type': 'Json', 'value': 'broken'}) == 'broken'
    assert decode({'type': 'Null', 'value': None}) is None

def test_whitelist_and_reserved():
    schema = {'components': [{'key': 'reason', 'type': 'textfield'}, {'type': 'group', 'components': [{'key': 'days', 'type': 'number'}]}, {'type': 'text', 'key': 'label'}]}
    assert clean_values(schema, {'reason': 'ok', 'days': 2, 'label': 'no', 'wf_status': 'approved', 'initiator': 'other', 'unknown': 3}) == {'reason': 'ok', 'days': 2}

@pytest.mark.parametrize('value', ['../x', 'a/b', 'a?b', '', 'x' * 101])
def test_bad_ids(value):
    with pytest.raises(HTTPException):
        valid_id(value)

def test_starter_groups():
    xml = '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:camunda="http://camunda.org/schema/1.0/bpmn"><process id="p" camunda:candidateStarterGroups="hr, manager"/></definitions>'
    assert starter_groups(xml) == {'hr', 'manager'}
    assert starter_groups('<broken') is None
