using DecisionOptionWorkspace.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using DecisionWorkspace.Api.Contracts;

namespace DecisionWorkspace.Api.Controllers;

[Route("api/decisions/{decisionId:guid}/options")]
[ApiController]
[Authorize]
public class DecisionOptionsController : ControllerBase
{
    private readonly DecisionOptionService _decisionOptionService;

    public DecisionOptionsController(
        DecisionOptionService decisionOptionService
    )
    {
        _decisionOptionService = decisionOptionService;
    }

    private Guid GetUserId()
    {
        var userId = User.FindFirst("sub")?.Value;

        if (!Guid.TryParse(userId, out var parsedUserId))
        {
            throw new UnauthorizedAccessException(
                "Invalid user ID."
            );
        }

        return parsedUserId;
    }

    [HttpPost]
    public async Task<IActionResult> CreateAsync(
        Guid decisionId,
        [FromBody] CreateDecisionOptionRequest request
    )
    {
        var result = await _decisionOptionService.CreateAsync(
            GetUserId(),
            decisionId,
            request
        );

        return result.Status switch
        {
            CreateDecisionOptionStatus.Success =>
                Ok(result.Option),

            CreateDecisionOptionStatus.DecisionNotFound =>
                NotFound(),

            CreateDecisionOptionStatus.InvalidCriterion =>
                BadRequest(
                    "One or more criteria do not belong to this decision."
                ),

            CreateDecisionOptionStatus.DuplicateCriterion =>
                BadRequest(
                    "Each criterion can only be scored once per option."
                ),

            _ => StatusCode(500),
        };
    }

    [HttpGet]
    public async Task<IActionResult> GetByDecisionId(
        Guid decisionId
    )
    {
        var decisionOptions =
            await _decisionOptionService.GetByDecisionIdAsync(
                GetUserId(),
                decisionId
            );

        if (decisionOptions == null)
        {
            return NotFound();
        }

        return Ok(decisionOptions);
    }

    [HttpPut("{decisionOptionId:guid}")]
    public async Task<IActionResult> UpdateAsync(
        Guid decisionId,
        Guid decisionOptionId,
        [FromBody] CreateDecisionOptionRequest request
    )
    {
        var decisionOption =
            await _decisionOptionService.UpdateAsync(
                GetUserId(),
                decisionId,
                decisionOptionId,
                request
            );

        if (decisionOption == null)
        {
            return NotFound();
        }

        return Ok(decisionOption);
    }

    [HttpDelete("{decisionOptionId:guid}")]
    public async Task<IActionResult> DeleteAsync(
        Guid decisionId,
        Guid decisionOptionId
    )
    {
        var deleted =
            await _decisionOptionService.DeleteAsync(
                GetUserId(),
                decisionId,
                decisionOptionId
            );

        if (!deleted)
        {
            return NotFound();
        }

        return NoContent();
    }
}