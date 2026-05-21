import pytest
from django.core.exceptions import ValidationError

from apps.billing.services.dependencies import detect_cycle
from apps.billing.services.dependencies import expand_dependencies
from apps.billing.services.dependencies import validate_dependencies
from apps.billing.tests.factories import FeatureDependencyFactory
from apps.billing.tests.factories import FeatureFactory


@pytest.mark.django_db
class TestValidateDependencies:
    def test_passes_when_all_present(self):
        f1 = FeatureFactory(code="f1", is_active=True)
        f2 = FeatureFactory(code="f2", is_active=True)
        FeatureDependencyFactory(feature=f1, depends_on=f2)
        validate_dependencies({"f1", "f2"})  # no exception

    def test_fails_when_missing_dep(self):
        f1 = FeatureFactory(code="g1", is_active=True)
        f2 = FeatureFactory(code="g2", is_active=True)
        FeatureDependencyFactory(feature=f1, depends_on=f2)
        with pytest.raises(ValidationError, match="g2"):
            validate_dependencies({"g1"})

    def test_chain_A_B_C(self):
        a = FeatureFactory(code="fa", is_active=True)
        b = FeatureFactory(code="fb", is_active=True)
        c = FeatureFactory(code="fc", is_active=True)
        FeatureDependencyFactory(feature=a, depends_on=b)
        FeatureDependencyFactory(feature=b, depends_on=c)
        # a needs b which needs c
        with pytest.raises(ValidationError):
            validate_dependencies({"fa", "fb"})  # fc missing
        validate_dependencies({"fa", "fb", "fc"})  # all present, ok

    def test_inactive_dependency_ignored(self):
        f1 = FeatureFactory(code="h1", is_active=True)
        f2 = FeatureFactory(code="h2", is_active=False)
        FeatureDependencyFactory(feature=f1, depends_on=f2)
        # Dependency on inactive feature is ignored
        validate_dependencies({"h1"})  # no exception


@pytest.mark.django_db
class TestExpandDependencies:
    def test_includes_transitive_deps(self):
        a = FeatureFactory(code="ea", is_active=True)
        b = FeatureFactory(code="eb", is_active=True)
        c = FeatureFactory(code="ec", is_active=True)
        FeatureDependencyFactory(feature=a, depends_on=b)
        FeatureDependencyFactory(feature=b, depends_on=c)
        result = expand_dependencies({"ea"})
        assert "eb" in result
        assert "ec" in result

    def test_no_expansion_needed(self):
        FeatureFactory(code="solo", is_active=True)
        result = expand_dependencies({"solo"})
        assert result == {"solo"}

    def test_inactive_dep_not_included(self):
        a = FeatureFactory(code="ia", is_active=True)
        b = FeatureFactory(code="ib", is_active=False)
        FeatureDependencyFactory(feature=a, depends_on=b)
        result = expand_dependencies({"ia"})
        assert "ib" not in result


@pytest.mark.django_db
class TestDetectCycle:
    def test_no_cycle_simple(self):
        a = FeatureFactory(code="ca", is_active=True)
        b = FeatureFactory(code="cb", is_active=True)
        # No edges yet
        assert detect_cycle(a, b) is False

    def test_detect_2_node_cycle(self):
        a = FeatureFactory(code="da", is_active=True)
        b = FeatureFactory(code="db", is_active=True)
        FeatureDependencyFactory(feature=b, depends_on=a)  # b → a
        # Adding a → b would create cycle a → b → a
        assert detect_cycle(a, b) is True

    def test_detect_3_node_cycle(self):
        a = FeatureFactory(code="ta", is_active=True)
        b = FeatureFactory(code="tb", is_active=True)
        c = FeatureFactory(code="tc", is_active=True)
        FeatureDependencyFactory(feature=b, depends_on=a)  # b → a
        FeatureDependencyFactory(feature=c, depends_on=b)  # c → b
        # Adding a → c would create: a → c → b → a
        assert detect_cycle(a, c) is True

    def test_self_loop_not_detected_by_cycle_check(self):
        # Self-loops are caught by DB CheckConstraint, not detect_cycle
        a = FeatureFactory(code="sa", is_active=True)
        # detect_cycle(a, a) should return True because BFS from a reaches a immediately
        assert detect_cycle(a, a) is True
