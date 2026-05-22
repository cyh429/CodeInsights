from pathlib import Path
import unittest


class HomepageStructureTest(unittest.TestCase):
    def test_core_files_exist(self):
        root = Path(__file__).resolve().parents[1]
        self.assertTrue((root / "index.html").exists())
        self.assertTrue((root / "styles.css").exists())
        self.assertTrue((root / "app.js").exists())

    def test_required_sections_present(self):
        html = (Path(__file__).resolve().parents[1] / "index.html").read_text(encoding="utf-8")
        for section_id in [
            "hero",
            "proof",
            "architecture",
            "pipeline",
            "sdk-hybrid",
            "capabilities",
            "comparison",
            "quickstart",
            "dataflow",
        ]:
            self.assertIn(f'id="{section_id}"', html)

    def test_language_toggle_hook_present(self):
        html = (Path(__file__).resolve().parents[1] / "index.html").read_text(encoding="utf-8")
        self.assertIn('data-lang="zh"', html)
        self.assertIn('data-lang-toggle="header"', html)

    def test_footer_has_language_toggle(self):
        html = (Path(__file__).resolve().parents[1] / "index.html").read_text(encoding="utf-8")
        self.assertIn('data-lang-toggle="footer"', html)

    def test_diagram_assets_exist(self):
        root = Path(__file__).resolve().parents[1]
        self.assertTrue((root / "assets/diagrams/architecture-v2.svg").exists())
        self.assertTrue((root / "assets/diagrams/pipeline.svg").exists())
        self.assertTrue((root / "assets/diagrams/sdk-hybrid.svg").exists())
        self.assertTrue((root / "assets/diagrams/dataflow.svg").exists())

    def test_preview_assets_exist(self):
        root = Path(__file__).resolve().parents[1]
        for name in ["preview-qa.svg", "preview-rag.svg", "preview-system.svg"]:
            self.assertTrue((root / "assets/previews" / name).exists())

    def test_key_copy_and_ctas_present(self):
        html = (Path(__file__).resolve().parents[1] / "index.html").read_text(encoding="utf-8")
        for text in [
            "View on GitHub",
            "Quick Start",
            "RISC-V",
            "Claude Agent SDK",
            "OpenAI Agents SDK",
            "Human-in-the-Loop",
            "assets/diagrams/architecture-v2.svg",
            "assets/diagrams/pipeline.svg",
            "assets/diagrams/sdk-hybrid.svg",
            "assets/diagrams/dataflow.svg",
        ]:
            self.assertIn(text, html)

    def test_readme_mentions_local_preview(self):
        readme = (Path(__file__).resolve().parents[1] / "README.md").read_text(encoding="utf-8")
        self.assertIn("python -m http.server", readme)

    def test_system_preview_avoids_fake_service_topology_terms(self):
        preview = (Path(__file__).resolve().parents[1] / "assets/previews/preview-system.svg").read_text(encoding="utf-8")
        for text in ["Ingress", "Core services", "cluster layers"]:
            self.assertNotIn(text, preview)

    def test_pages_workflow_exists(self):
        root = Path(__file__).resolve().parents[2]
        self.assertTrue((root / ".github/workflows/deploy-pages.yml").exists())

    def test_repo_readmes_include_pages_url(self):
        root = Path(__file__).resolve().parents[2]
        expected = "https://zcxggmu.github.io/CodeInsights/"
        readmes = [path for path in [root / "README.md", root / "README_zh.md"] if path.exists()]
        self.assertTrue(readmes)
        for readme in readmes:
            self.assertIn(expected, readme.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
