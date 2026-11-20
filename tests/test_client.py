import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('tunnel', ROOT/'tunnel.py')
tunnel = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tunnel)

class ClientTests(unittest.TestCase):
    def test_large_declarative_scene_and_limit(self):
        tunnel.validate({'version':1,'actions':[{'op':'ping'}]*800})
        with self.assertRaises(ValueError):
            tunnel.validate({'version':1,'actions':[{'op':'ping'}]*2001})

    def test_examples_validate(self):
        for f in (ROOT/'examples').glob('*.json'):
            tunnel.validate(json.loads(f.read_text()))

    def test_reject_unknown_operation(self):
        with self.assertRaises(ValueError):
            tunnel.validate({'version':1,'actions':[{'op':'shell'}]})

    def test_reject_nonfinite_values(self):
        with self.assertRaises(ValueError):
            tunnel.validate({'version':1,'actions':[{'op':'set','value':float('nan')}]})

    def test_alias_collision(self):
        with self.assertRaises(ValueError):
            tunnel.validate({'version':1,'actions':[{'op':'createComp','as':'x'},{'op':'text','as':'x'}]})

    def test_payload_is_literal_not_shell(self):
        req={'version':1,'actions':[{'op':'text','text':'"; $HOME `whoami` \n مرحبا'}]}
        script=tunnel.build_script(req)
        payload=script.rsplit('AETunnel.show(AETunnel.run(',1)[1][:-4]
        self.assertEqual(json.loads(payload),req)

if __name__ == '__main__':
    unittest.main()
