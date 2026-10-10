using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using DecisionWorkspace.Api.Contracts;
using DecisionWorkspace.Api.Services;

namespace DecisionWorkspace.Api.Controllers;

[Route("api/decisions/{decisionId:guid}/options/{decisionOptionId:guid}/attributes")]
[ApiController]
[Authorize]
public class DecisionOptionAttributesController : ControllerBase
{
    private readonly DecisionOptionAttributeService _decisionOptionAttributeService;

    public DecisionOptionAttributesController(
        DecisionOptionAttributeService decisionOptionAttributeService
    )
    {
        _decisionOptionAttributeService = decisionOptionAttributeService;
    }

    private Guid GetUserId()
    {
        var userId = User.FindFirst("sub")?.Value;

        if (!Guid.TryParse(userId, out var parsedUserId))
        {
            throw new UnauthorizedAccessException("Invalid user ID.");
        }

        return parsedUserId;
    }

    [HttpPost]
    public async Task<IActionResult> CreateAsync(
        Guid decisionId,
        Guid decisionOptionId,
        [FromBody] CreateDecisionOptionAttributeRequest request
    )
    {
        var decisionOptionAttribute =
            await _decisionOptionAttributeService.CreateAsync(
                GetUserId(),
                decisionId,
                decisionOptionId,
                request
            );

        if (decisionOptionAttribute == null)
        {
            return NotFound();
        }

        return Ok(decisionOptionAttribute);
    }

    [HttpGet]
    public async Task<IActionResult> GetByDecisionOptionIdAsync(
        Guid decisionId,
        Guid decisionOptionId
    )
    {
        var decisionOptionAttributes =
            await _decisionOptionAttributeService.GetByDecisionOptionIdAsync(
                GetUserId(),
                decisionId,
                decisionOptionId
            );

        if (decisionOptionAttributes == null)
        {
            return NotFound();
        }

        return Ok(decisionOptionAttributes);
    }

    [HttpPut]
    public async Task<IActionResult> UpdateAsync(
        Guid decisionId,
        Guid decisionOptionId,
        [FromBody] List<CreateDecisionOptionAttributeRequest> requests
    )
    {
        var attributes =
            await _decisionOptionAttributeService.UpdateAsync(
                GetUserId(),
                decisionId,
                decisionOptionId,
                requests
            );

        if (attributes == null)
        {
            return NotFound();
        }

        return Ok(attributes);
    }
}