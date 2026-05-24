from html.parser import HTMLParser
from pathlib import Path
import unittest


class LocalReferenceParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.references = []

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if name not in {"href", "src", "poster"} or not value:
                continue
            if value.startswith("#") or value.startswith(("http://", "https://", "mailto:", "tel:")):
                continue
            self.references.append(value)


class HomepageStructureTest(unittest.TestCase):
    def setUp(self):
        self.root = Path(__file__).resolve().parents[1]
        self.repo_root = self.root.parents[0]
        self.html = (self.root / "index.html").read_text(encoding="utf-8")
        self.css = (self.root / "styles.css").read_text(encoding="utf-8")

    def test_core_files_exist(self):
        self.assertTrue((self.root / "index.html").exists())
        self.assertTrue((self.root / "styles.css").exists())
        self.assertTrue((self.root / "app.js").exists())

    def test_required_sections_present(self):
        for section_id in [
            "hero",
            "proof",
            "showcase",
            "pipeline",
            "agent-runtime",
            "local-first",
            "capabilities",
            "quickstart",
        ]:
            self.assertIn(f'id="{section_id}"', self.html)

    def test_language_toggle_hooks_present(self):
        self.assertIn('data-lang="zh"', self.html)
        self.assertIn('data-lang-toggle="header"', self.html)
        self.assertIn('data-lang-toggle="footer"', self.html)

    def test_current_homepage_assets_exist(self):
        required_assets = [
            "assets/brand/logo-128.png",
            "assets/screenshots/pipeline-dashboard.jpg",
            "assets/screenshots/agent-workbench.jpg",
            "assets/screenshots/settings-overview.jpg",
            "assets/screenshots/agent-settings.jpg",
            "assets/video/codeinsights-real-run-overview.mp4",
            "assets/video/codeinsights-intro-20s.mp4",
            "assets/video/real-run-contact-sheet.jpg",
            "assets/diagrams-current/codeinsights-system-architecture.svg",
            "assets/diagrams-current/codeinsights-pipeline-langgraph-flow.svg",
            "assets/diagrams-current/codeinsights-agent-runtime-flow.svg",
            "assets/diagrams-current/codeinsights-ipc-state-flow.svg",
            "assets/diagrams-current/codeinsights-local-storage-framework.svg",
        ]
        for relative_path in required_assets:
            self.assertTrue((self.root / relative_path).exists(), relative_path)

    def test_responsive_media_preserves_aspect_ratio(self):
        self.assertIn("height: auto;", self.css)
        self.assertIn(".diagram-panel img", self.css)
        self.assertIn(".diagram-card img", self.css)

    def test_all_local_html_references_exist(self):
        parser = LocalReferenceParser()
        parser.feed(self.html)
        self.assertTrue(parser.references)
        for reference in parser.references:
            clean_reference = reference.split("#", 1)[0].split("?", 1)[0]
            if not clean_reference:
                continue
            local_path = (self.root / clean_reference).resolve()
            self.assertTrue(str(local_path).startswith(str(self.root.resolve())))
            self.assertTrue(local_path.exists(), reference)

    def test_key_copy_and_ctas_present(self):
        for text in [
            "Product",
            "Workflow",
            "Architecture",
            "Watch Real Run",
            "Quick Start",
            "Shape the plan",
            "plan.md",
            "Before launch",
            "Agent-compatible channel",
            "Complex contribution needs process quality",
            "Complex edits drift easily",
            "Turn risk into checkpoints",
            "Pipeline v2",
            "Claude Agent SDK",
            "Codex SDK / CLI",
            "JSONL",
            "MCP",
            "Bun",
            "bun run dev",
            "assets/screenshots/pipeline-dashboard.jpg",
            "assets/diagrams-current/codeinsights-pipeline-langgraph-flow.svg",
            "assets/diagrams-current/codeinsights-agent-runtime-flow.svg",
        ]:
            self.assertIn(text, self.html)

    def test_old_homepage_positioning_removed(self):
        forbidden_terms = [
            "RISC-V",
            "OpenAI Agents SDK",
            "requirements.txt",
            "python -m codeinsights",
            "Dual SDK",
            "SWE-Agent",
            "OpenDevin",
            "QEMU",
            "Chroma",
            "Milvus",
        ]
        searchable_files = [
            self.root / "index.html",
            self.root / "styles.css",
            self.root / "README.md",
        ]
        for path in searchable_files:
            content = path.read_text(encoding="utf-8")
            for term in forbidden_terms:
                self.assertNotIn(term, content, f"{term} found in {path}")

    def test_obsolete_public_asset_dirs_removed(self):
        self.assertFalse((self.root / "assets/diagrams").exists())
        self.assertFalse((self.root / "assets/previews").exists())

    def test_readme_mentions_local_preview(self):
        readme = (self.root / "README.md").read_text(encoding="utf-8")
        self.assertIn("python -m http.server", readme)

    def test_pages_workflow_exists(self):
        self.assertTrue((self.repo_root / ".github/workflows/deploy-pages.yml").exists())

    def test_repo_readmes_include_pages_url(self):
        expected = "https://zcxggmu.github.io/CodeInsights/"
        readmes = [path for path in [self.repo_root / "README.md", self.repo_root / "README_zh.md"] if path.exists()]
        self.assertTrue(readmes)
        for readme in readmes:
            self.assertIn(expected, readme.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
