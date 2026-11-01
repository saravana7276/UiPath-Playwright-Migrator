using System.Threading.Tasks;
using Microsoft.Playwright;
using Microsoft.Playwright.NUnit;
using NUnit.Framework;

namespace PathWright.Tests;

[Parallelizable(ParallelScope.Self)]
[TestFixture]
public class MigratedUiPathWebJourney : PageTest
{
    [Test]
    public async Task ExecuteMigratedJourney()
    {
        var targetUrl = System.Environment.GetEnvironmentVariable("TARGET_URL") ?? "https://example.com";

        // Step 1: Navigate to Target Web Page
        await Page.GotoAsync(targetUrl);

        // Step 2: Click on Submit
        var element = Page.GetByRole(AriaRole.Button).First;
        await Expect(element).ToBeVisibleAsync();
        await element.ClickAsync();

    }
}
