using Microsoft.AspNetCore.Mvc;
using DecisionWorkspace.Api.Contracts;
using DecisionWorkspace.Api.Services;

namespace DecisionWorkspace.Api.Controllers;

[Route("api/decisions/{decisionId:guid}/options/{decisionOptionId:guid}/attributes")]
[ApiController]
public class DecisionOptionAttributesController : ControllerBase
{
    private readonly DecisionOptionAttributeService _decisionOptionAttributeService;

    public DecisionOptionAttributesController(DecisionOptionAttributeService decisionOptionAttributeService)
    {
        _decisionOptionAttributeService = decisionOptionAttributeService;
    }

    [HttpPost]
    public async Task<IActionResult> CreateAsync(Guid decisionId, Guid decisionOptionId, [FromBody] CreateDecisionOptionAttributeRequest request)
    {
        var decisionOptionAttribute = await _decisionOptionAttributeService.CreateAsync(decisionId, decisionOptionId, request);

        if (decisionOptionAttribute == null)
        {
            return NotFound();
        }

        return Ok(decisionOptionAttribute);
    }

    [HttpGet]
    public async Task<IActionResult> GetByDecisionOptionIdAsync(Guid decisionId, Guid decisionOptionId)
    {
        var decisionOptionAttributes = await _decisionOptionAttributeService.GetByDecisionOptionIdAsync(decisionId, decisionOptionId);

        if (decisionOptionAttributes == null)
        {
            return NotFound();
        }

        return Ok(decisionOptionAttributes);
    }
}